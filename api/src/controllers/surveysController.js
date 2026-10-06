// ══════════════════════════════════════════════════════════
// Contrôleur Enquêtes — CRUD admin + consultation publique
//
// Même logique "cuisine / salle" que les propositions :
// - DRAFT n'est visible que par l'admin (encore en préparation)
// - OPEN et CLOSED sont publiques (répondable / résultats consultables)
//
// Particularité par rapport à Proposal : une enquête est un AGRÉGAT —
// elle n'existe pas sans ses questions, et une question CHOIX_UNIQUE/
// CHOIX_MULTIPLE n'existe pas sans ses options. Créer une enquête crée
// donc TOUJOURS ses questions (et leurs options) dans la même écriture,
// imbriquées via les nested writes de Prisma — jamais en plusieurs
// appels séparés qui pourraient laisser une enquête à moitié construite.
// ══════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';
import { logAdminAction, AUDIT_ACTIONS } from '../services/audit.js';
import { generateUniqueSlug } from '../lib/slug.js';
import { MIN_GROUP_SIZE, isTooSmall, maskSmallQuestions } from '../lib/privacy.js';
import { visibleQuestionIds, withConditionIds } from '../lib/surveyFlow.js';
import { audienceOf, matchesAudience, isEveryone, AUDIENCE_PROFILE_SELECT } from '../lib/audience.js';
import { toNestedQuestionsCreate, resolveReferences, questionsUnchanged } from '../services/surveyBuilder.js';

const VISIBLE_STATUSES = ['OPEN', 'CLOSED'];

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  // Public visé (S5R-07) : les 4 listes de critères, regroupées en un
  // objet `audience` par serializeAudience avant l'envoi au client
  audienceSituations: true,
  audienceQuartiers: true,
  audienceWorkQuartiers: true,
  audienceWorkTypes: true,
  status: true,
  resultsPublished: true,
  opensAt: true,
  closesAt: true,
};

// orderBy explicite sur "order" : sans ça, Prisma renvoie les questions
// dans un ordre non garanti (proche de l'ordre d'insertion en pratique,
// mais rien ne le garantit dans le temps) — le questionnaire s'afficherait
// dans le désordre au moindre aléa.
const QUESTIONS_INCLUDE = {
  questions: {
    orderBy: { order: 'asc' },
    include: {
      options: { orderBy: { order: 'asc' } },
      // S5R-05 : les conditions d'affichage (OU) de chaque question
      conditions: { select: { optionId: true } },
    },
  },
};

/**
 * Forme renvoyée au client : chaque question porte
 * `conditionOptionIds: [...]` (plus simple à exploiter qu'une liste
 * d'objets { optionId }). Voir lib/surveyFlow.js.
 */
function serializeSurvey(survey) {
  return survey && { ...serializeAudience(survey), questions: survey.questions?.map(withConditionIds) };
}

/**
 * S5R-07 : les 4 colonnes de critères deviennent un seul objet
 * `audience` ({ situations, quartiers, workQuartiers, workTypes }),
 * plus simple à lire et à renvoyer tel quel depuis le formulaire.
 */
function serializeAudience(survey) {
  const {
    audienceSituations, audienceQuartiers, audienceWorkQuartiers, audienceWorkTypes, ...rest
  } = survey;
  return { ...rest, audience: audienceOf({ audienceSituations, audienceQuartiers, audienceWorkQuartiers, audienceWorkTypes }) };
}

/** Objet `audience` reçu (Zod) → colonnes Prisma. */
function audienceToFields(audience) {
  if (!audience) return {};
  return {
    audienceSituations: audience.situations ?? [],
    // Les quartiers de résidence n'ont de sens qu'avec « autre quartier »
    audienceQuartiers: (audience.situations ?? []).includes('AUTRE_QUARTIER') ? (audience.quartiers ?? []) : [],
    audienceWorkQuartiers: audience.workQuartiers ?? [],
    audienceWorkTypes: audience.workTypes ?? [],
  };
}

// Transformation des questions reçues et résolution des références
// (conditions, limites de cases) : voir services/surveyBuilder.js,
// partagé avec le seed de production (S5R-05).

// ── GET /surveys/admin — liste ADMIN, tous statuts confondus ───
export async function listAdmin(req, res, next) {
  try {
    const { page, limit, status } = req.validatedQuery;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      prisma.survey.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.survey.count({ where }),
    ]);

    res.json({
      items: items.map(serializeAudience),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /surveys — liste paginée, publique ──────────────
export async function list(req, res, next) {
  try {
    const { page, limit, status } = req.validatedQuery;
    const where = { status: status || { in: VISIBLE_STATUSES } };

    const [items, total] = await Promise.all([
      prisma.survey.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.survey.count({ where }),
    ]);

    res.json({
      items: items.map(serializeAudience),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /surveys/:slug — détail avec questions + options ───
export async function getBySlug(req, res, next) {
  try {
    const { slug } = req.params;

    const survey = await prisma.survey.findUnique({
      where: { slug },
      include: QUESTIONS_INCLUDE,
    });

    // req.user n'existe que si optionalAuth a trouvé un JWT valide.
    const isAdmin = req.user?.role === 'ADMIN';

    if (!survey || (!VISIBLE_STATUSES.includes(survey.status) && !isAdmin)) {
      const error = new Error('Enquête introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // hasResponded : null pour un visiteur anonyme (on ne sait pas —
    // différent de false, qui affirmerait "non" à tort). Permet au
    // client d'afficher "Répondre" vs "Voir les résultats" sans faire
    // tout le parcours pour se prendre un 409 à la toute fin.
    let hasResponded = null;
    if (req.user) {
      const existing = await prisma.surveyResponse.findUnique({
        where: { userId_surveyId: { userId: req.user.userId, surveyId: survey.id } },
        select: { id: true },
      });
      hasResponded = !!existing;
    }

    // S5R-07 : la personne connectée fait-elle partie du public visé ?
    // true / false / null (profil trop incomplet pour le dire, ou visiteur
    // anonyme) — affiché à titre INDICATIF : tout le monde peut répondre.
    let inAudience = null;
    if (req.user) {
      const profile = await prisma.user.findUnique({ where: { id: req.user.userId }, select: AUDIENCE_PROFILE_SELECT });
      inAudience = matchesAudience(audienceOf(survey), profile);
    }

    res.json({ survey: serializeSurvey(survey), hasResponded, inAudience });
  } catch (err) {
    next(err);
  }
}

// ── POST /surveys — créer, questions/options incluses (admin) ──
export async function create(req, res, next) {
  try {
    const { title, description, audience, status, opensAt, closesAt, questions } = req.body;

    const slug = await generateUniqueSlug(title, prisma.survey);

    // $transaction : la création ET la résolution du branchement
    // doivent réussir ENSEMBLE — un crash entre les deux laisserait
    // une enquête avec des questions mais un branchement à moitié posé.
    const survey = await prisma.$transaction(async (tx) => {
      const created = await tx.survey.create({
        data: {
          slug,
          title,
          description,
          ...audienceToFields(audience), // S5R-07 : rien = tout le monde
          status: status || 'DRAFT',
          opensAt,
          closesAt,
          questions: { create: toNestedQuestionsCreate(questions) },
        },
      });

      await resolveReferences(tx, created.id, questions);

      return tx.survey.findUnique({ where: { id: created.id }, include: QUESTIONS_INCLUDE });
    });

    await logAdminAction({
      actorId: req.user.userId,
      action: AUDIT_ACTIONS.SURVEY_CREATED,
      targetType: 'Survey',
      targetId: survey.id,
      details: { title: survey.title, status: survey.status },
    });

    res.status(201).json({ survey: serializeSurvey(survey) });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /surveys/:id — éditer (admin) ─────────────────
//
// Si `questions` est fourni, il REMPLACE l'intégralité du
// questionnaire existant plutôt que d'essayer de faire correspondre
// chaque question envoyée à une ligne en base (diff fragile — que
// faire si le libellé d'une question a changé, est-ce la même
// question modifiée ou une autre à sa place ?). Le contrat côté
// client (constructeur d'enquête, Sprint 4) est donc d'envoyer
// l'état COMPLET du questionnaire à chaque sauvegarde, jamais un
// delta — même principe qu'un traitement de texte qui sauvegarde
// le document entier, pas la liste des frappes clavier.
export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.survey.findUnique({
      where: { id },
      include: QUESTIONS_INCLUDE,
    });

    if (!existing) {
      const error = new Error('Enquête introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // audience (S5R-07) est converti à part en colonnes Prisma
    const { questions, audience: audienceInput, ...surveyFields } = req.body;

    // Le formulaire admin envoie TOUJOURS le questionnaire complet,
    // même quand seul le statut a changé — donc `questions` étant
    // présent ne veut pas dire "l'admin a modifié les questions".
    // On ne considère un VRAI changement (et donc le garde-fou
    // ci-dessous) que si le contenu diffère réellement de l'existant.
    const questionsActuallyChanged = questions && !questionsUnchanged(existing.questions, questions);

    // Garde-fou : Question a onDelete: Cascade vers Answer (voir
    // schema.prisma). Remplacer les questions d'une enquête qui a
    // déjà reçu des réponses effacerait ces réponses sans prévenir —
    // même logique de prudence que RGPD/onDelete ailleurs dans ce
    // projet. On bloque plutôt que de détruire silencieusement des
    // données de citoyens.
    if (questionsActuallyChanged) {
      const responseCount = await prisma.surveyResponse.count({ where: { surveyId: id } });
      if (responseCount > 0) {
        const error = new Error(
          "Impossible de modifier les questions d'une enquête ayant déjà reçu des réponses — clôturez-la et créez-en une nouvelle si besoin.",
        );
        error.status = 409;
        error.code = 'SURVEY_HAS_RESPONSES';
        throw error;
      }
    }

    // $transaction : "supprimer les anciennes questions" + "en créer
    // de nouvelles" doit réussir ENSEMBLE ou pas du tout — sinon un
    // crash au milieu laisserait l'enquête sans AUCUNE question.
    const survey = await prisma.$transaction(async (tx) => {
      if (questionsActuallyChanged) {
        // Cascade se charge des QuestionOption liées.
        await tx.question.deleteMany({ where: { surveyId: id } });
      }

      await tx.survey.update({
        where: { id },
        data: {
          ...surveyFields,
          ...audienceToFields(audienceInput),
          ...(questionsActuallyChanged && { questions: { create: toNestedQuestionsCreate(questions) } }),
        },
      });

      if (questionsActuallyChanged) {
        await resolveReferences(tx, id, questions);
      }

      return tx.survey.findUnique({ where: { id }, include: QUESTIONS_INCLUDE });
    });

    // Noms des champs modifiés + les changements qui comptent le plus
    // pour la suite : statut (ouvrir / clore) et publication des résultats.
    await logAdminAction({
      actorId: req.user.userId,
      action: AUDIT_ACTIONS.SURVEY_UPDATED,
      targetType: 'Survey',
      targetId: id,
      details: {
        title: survey.title,
        fields: Object.keys(req.body),
        ...(req.body.status && req.body.status !== existing.status && {
          status: { from: existing.status, to: req.body.status },
        }),
        ...(req.body.resultsPublished !== undefined && req.body.resultsPublished !== existing.resultsPublished && {
          resultsPublished: req.body.resultsPublished,
        }),
      },
    });

    res.json({ survey: serializeSurvey(survey) });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /surveys/:id — supprimer (admin) ─────────────
export async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.survey.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Enquête introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Même garde-fou qu'à l'édition : Survey a onDelete: Cascade vers
    // SurveyResponse (voir schema.prisma) — supprimer une enquête qui
    // a déjà des réponses effacerait les réponses des citoyens avec.
    const responseCount = await prisma.surveyResponse.count({ where: { surveyId: id } });
    if (responseCount > 0) {
      const error = new Error(
        "Impossible de supprimer une enquête ayant déjà reçu des réponses — clôturez-la (status CLOSED) plutôt que de la supprimer.",
      );
      error.status = 409;
      error.code = 'SURVEY_HAS_RESPONSES';
      throw error;
    }

    await prisma.survey.delete({ where: { id } });

    await logAdminAction({
      actorId: req.user.userId,
      action: AUDIT_ACTIONS.SURVEY_DELETED,
      targetType: 'Survey',
      targetId: id,
      details: { title: existing.title },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ── GET /surveys/:slug/results — agrégats des réponses ──────
//
// Une seule requête groupBy par "famille" de question (à choix vs
// numérique vs texte libre) plutôt qu'une requête par question —
// même principe que getVoteAggregatesForMany pour les propositions :
// une enquête à 10 questions ne doit pas faire 10 allers-retours
// vers Postgres pour afficher sa page de résultats.
//
// Choix assumé : le pourcentage de chaque option est calculé sur
// totalResponses (le nombre TOTAL de bulletins déposés), pas sur le
// nombre de personnes ayant répondu à CETTE question précise. Plus
// simple à calculer, et ça évite un piège avec CHOIX_MULTIPLE (une
// personne peut cocher plusieurs options → compter "les répondants à
// cette question" compterait chaque case cochée comme une personne
// différente). Conséquence attendue et normale : les pourcentages
// d'une question CHOIX_MULTIPLE peuvent dépasser 100% au total.
const AGGREGATABLE_CHOICE_TYPES = ['CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'OUI_NON'];

// ── Agrégation des résultats — partagée entre la vue publique
// (getResults) et la vue admin détaillée (getDetailedResults) ──
//
// `detailed` change deux choses : le contenu brut des réponses
// TEXTE_LIBRE (jamais exposé publiquement) et la présence d'un
// écart audience/situation déclarée (utile pour l'admin, dénué de
// sens pour un visiteur qui n'a pas à connaître les autres citoyens).
// responseIds (optionnel) restreint le calcul à un SOUS-ENSEMBLE des
// bulletins de l'enquête — c'est ce qui permet la segmentation
// (S5-21) sans dupliquer toute cette logique d'agrégation : null
// veut dire "tout le monde", comme avant.
async function computeResults(survey, { detailed = false, responseIds = null } = {}) {
  const totalResponses = await prisma.surveyResponse.count({
    where: responseIds ? { id: { in: responseIds } } : { surveyId: survey.id },
  });

  const choiceQuestionIds = survey.questions
    .filter((q) => AGGREGATABLE_CHOICE_TYPES.includes(q.type))
    .map((q) => q.id);
  const numberQuestionIds = survey.questions
    .filter((q) => q.type === 'NOMBRE')
    .map((q) => q.id);
  const textQuestionIds = survey.questions
    .filter((q) => q.type === 'TEXTE_LIBRE')
    .map((q) => q.id);

  // Ajouté à chaque `where` d'Answer ci-dessous quand une
  // segmentation est demandée — {} ne change rien à une requête
  // Prisma, donc pas besoin de dupliquer chaque clause en deux
  // versions (avec/sans filtre).
  const responseFilter = responseIds ? { responseId: { in: responseIds } } : {};

  const [optionCounts, numberStats, textCounts, rawTextAnswers, situationCounts, responsesForFlow] = await Promise.all([
    choiceQuestionIds.length
      ? prisma.answer.groupBy({
        by: ['questionId', 'optionId'],
        where: { questionId: { in: choiceQuestionIds }, optionId: { not: null }, ...responseFilter },
        _count: true,
      })
      : [],
    numberQuestionIds.length
      ? prisma.answer.groupBy({
        by: ['questionId'],
        where: { questionId: { in: numberQuestionIds }, ...responseFilter },
        _count: { valueNumber: true },
        _avg: { valueNumber: true },
        _min: { valueNumber: true },
        _max: { valueNumber: true },
      })
      : [],
    textQuestionIds.length
      ? prisma.answer.groupBy({
        by: ['questionId'],
        where: { questionId: { in: textQuestionIds }, ...responseFilter },
        _count: { valueText: true },
      })
      : [],
    // Contenu brut du texte libre : demandé UNIQUEMENT par la vue
    // admin détaillée — inutile de le charger (et de le renvoyer) pour
    // la vue publique, qui n'affiche qu'un compte.
    detailed && textQuestionIds.length
      ? prisma.answer.findMany({
        where: { questionId: { in: textQuestionIds }, valueText: { not: null }, ...responseFilter },
        select: { questionId: true, valueText: true },
      })
      : [],
    // Profil déclaré des répondants — pour confronter au public visé
    // (S5R-07 : situation ET volet travail, voir lib/audience.js).
    // Uniquement pour la vue admin détaillée : la répartition des
    // situations des AUTRES citoyens n'a rien à faire dans une vue
    // publique.
    detailed
      ? prisma.surveyResponse.findMany({
        where: responseIds ? { id: { in: responseIds } } : { surveyId: survey.id },
        select: { user: { select: AUDIENCE_PROFILE_SELECT } },
      })
      : [],
    // S5R-05 : les options choisies par chaque répondant, pour rejouer
    // son parcours et savoir quelles questions il a VUES (voir plus bas)
    prisma.surveyResponse.findMany({
      where: responseIds ? { id: { in: responseIds } } : { surveyId: survey.id },
      select: { answers: { where: { optionId: { not: null } }, select: { questionId: true, optionId: true } } },
    }),
  ]);

  // Map à plat questionId+optionId → compte (nested) ET optionId seul
  // → compte (flat) — la version flat sert à retrouver combien de
  // personnes ont vu une question BRANCHÉE (celles qui ont choisi
  // l'option qui la déclenche), sans avoir à savoir à quelle question
  // cette option appartient.
  const optionCountsByQuestion = new Map();
  for (const row of optionCounts) {
    if (!optionCountsByQuestion.has(row.questionId)) {
      optionCountsByQuestion.set(row.questionId, new Map());
    }
    optionCountsByQuestion.get(row.questionId).set(row.optionId, row._count);
  }
  const numberStatsByQuestion = new Map(numberStats.map((row) => [row.questionId, row]));
  const textCountsByQuestion = new Map(
    textCounts.map((row) => [row.questionId, row._count.valueText]),
  );
  const rawTextByQuestion = new Map();
  for (const row of rawTextAnswers) {
    if (!rawTextByQuestion.has(row.questionId)) rawTextByQuestion.set(row.questionId, []);
    rawTextByQuestion.get(row.questionId).push(row.valueText);
  }

  // ── Combien de personnes ont VU chaque question ? (S5R-05) ──
  // C'est la base des pourcentages : « 80 % des personnes à qui on a
  // posé la question », pas « 12 % de tous les répondants » (une
  // question conditionnelle n'est vue que par une partie d'entre eux).
  // Avec des conditions multiples (OU) et des fins anticipées, ce nombre
  // ne se déduit plus d'un simple compteur : on REJOUE le parcours de
  // chaque répondant avec le même moteur que le questionnaire
  // (lib/surveyFlow.js).
  const flowQuestions = survey.questions.map(withConditionIds);
  const seenCount = new Map();
  for (const response of responsesForFlow) {
    const chosen = new Map();
    for (const a of response.answers) {
      if (!chosen.has(a.questionId)) chosen.set(a.questionId, []);
      chosen.get(a.questionId).push(a.optionId);
    }
    for (const id of visibleQuestionIds(flowQuestions, (qid) => chosen.get(qid) ?? [])) {
      seenCount.set(id, (seenCount.get(id) || 0) + 1);
    }
  }

  const questions = flowQuestions.map((question) => {
    const questionTotal = seenCount.get(question.id) || 0;

    const base = {
      id: question.id,
      label: question.label,
      type: question.type,
      required: question.required,
      conditionOptionIds: question.conditionOptionIds,
      totalForQuestion: questionTotal,
    };

    if (AGGREGATABLE_CHOICE_TYPES.includes(question.type)) {
      const countsForQuestion = optionCountsByQuestion.get(question.id);
      const options = question.options.map((option) => {
        const count = countsForQuestion?.get(option.id) || 0;
        return {
          id: option.id,
          label: option.label,
          count,
          percentage: questionTotal > 0
            ? Math.round((count / questionTotal) * 1000) / 10
            : 0,
        };
      });
      return { ...base, options };
    }

    if (question.type === 'NOMBRE') {
      const stats = numberStatsByQuestion.get(question.id);
      return {
        ...base,
        stats: {
          count: stats?._count.valueNumber || 0,
          average: stats?._avg.valueNumber ?? null,
          min: stats?._min.valueNumber ?? null,
          max: stats?._max.valueNumber ?? null,
        },
      };
    }

    // TEXTE_LIBRE : contenu brut réservé à la vue admin détaillée —
    // la vue publique n'expose que le nombre de réponses (jamais leur
    // contenu, qui pourrait identifier quelqu'un par recoupement).
    return {
      ...base,
      totalAnswered: textCountsByQuestion.get(question.id) || 0,
      ...(detailed && { answers: rawTextByQuestion.get(question.id) || [] }),
    };
  });

  const result = {
    survey: { id: survey.id, slug: survey.slug, title: survey.title, status: survey.status },
    totalResponses,
    questions,
  };

  if (detailed) {
    // Écart audience ciblée / situation réellement déclarée — une
    // enquête RESIDENTS qui reçoit majoritairement des réponses de
    // gens HORS_SENLIS, ça se voit ici, pas ailleurs.
    const situationBreakdown = {};
    for (const { user } of situationCounts) {
      const key = user?.situation || 'NON_RENSEIGNEE';
      situationBreakdown[key] = (situationBreakdown[key] || 0) + 1;
    }
    // S5R-07 : combien de répondants font partie du public visé ?
    // (profil ACTUEL des comptes ; « inconnu » = profil incomplet ou
    // compte supprimé depuis la réponse)
    const audience = audienceOf(survey);
    const audienceBreakdown = { inAudience: 0, outOfAudience: 0, unknown: 0 };
    for (const { user } of situationCounts) {
      const match = matchesAudience(audience, user);
      if (match === true) audienceBreakdown.inAudience += 1;
      else if (match === false) audienceBreakdown.outOfAudience += 1;
      else audienceBreakdown.unknown += 1;
    }
    result.audience = audience;
    result.audienceIsEveryone = isEveryone(audience);
    result.audienceBreakdown = audienceBreakdown;
    result.situationBreakdown = situationBreakdown;
  }

  return result;
}

export async function getResults(req, res, next) {
  try {
    const { slug } = req.params;

    const survey = await prisma.survey.findUnique({
      where: { slug },
      include: QUESTIONS_INCLUDE,
    });

    const isAdmin = req.user?.role === 'ADMIN';
    if (!survey || (!VISIBLE_STATUSES.includes(survey.status) && !isAdmin)) {
      const error = new Error('Enquête introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Distinct du statut ouvert/clos : l'admin décide SÉPARÉMENT du
    // moment où les résultats deviennent publics — voir
    // Survey.resultsPublished (revue du cahier des charges).
    // /surveys/:id/stats (getDetailedResults) reste la vue admin,
    // jamais concernée par ce garde-fou.
    if (!survey.resultsPublished && !isAdmin) {
      const error = new Error("Les résultats de cette enquête n'ont pas encore été publiés par l'administration");
      error.status = 403;
      error.code = 'RESULTS_NOT_PUBLISHED';
      throw error;
    }

    const result = await computeResults(survey, { detailed: false });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── Résultats d'un sous-groupe de répondants (S5R-08) ─────────
//
// Mêmes protections que la segmentation (S5-21), parce qu'un filtre
// « commerçant·es de Villevert » peut ne concerner que 2 personnes :
//  - groupe de 1 à 4 répondants → on dit qu'il existe, jamais ce qu'il
//    a répondu (secret statistique, lib/privacy.js) ;
//  - dans un groupe assez grand, une question vue par moins de 5 de
//    ses membres est masquée à son tour ;
//  - PAS de texte libre brut (detailed: false) : « une phrase + tel
//    profil » suffit souvent à reconnaître son auteur.
// Analogie : un bureau de vote ne publie pas le résultat d'une urne qui
// ne contiendrait que 3 bulletins.
async function computeFilteredResults(survey, scope, filterAudience) {
  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId: survey.id },
    select: { id: true, user: { select: AUDIENCE_PROFILE_SELECT } },
  });
  const responseIds = responses
    .filter((r) => matchesAudience(filterAudience, r.user) === true)
    .map((r) => r.id);

  const header = {
    survey: { id: survey.id, slug: survey.slug, title: survey.title, status: survey.status },
    audience: audienceOf(survey),
    audienceIsEveryone: isEveryone(audienceOf(survey)),
    filter: { scope, audience: filterAudience },
    minGroupSize: MIN_GROUP_SIZE,
  };

  if (isTooSmall(responseIds.length)) {
    return { ...header, masked: true, totalResponses: null, questions: [] };
  }

  const result = await computeResults(survey, { detailed: false, responseIds });
  return { ...header, masked: false, totalResponses: result.totalResponses, questions: maskSmallQuestions(result.questions) };
}

// ── GET /surveys/:id/stats — résultats détaillés (admin) ──
//
// Distincte de getResults : jamais soumise au garde-fou
// resultsPublished (l'admin voit toujours), contenu brut des
// réponses TEXTE_LIBRE inclus, et écart audience/situation déclarée.
//
// ?segmentBy=<questionId> (optionnel, S5-21) : recalcule les mêmes
// résultats séparément pour chaque option d'UNE question à choix
// unique de l'enquête — ex. les résultats "pour les habitants du
// centre" vs "pour les patrons/gérants" vs... — en plus du total
// général, jamais à sa place.
export async function getDetailedResults(req, res, next) {
  try {
    const { id } = req.params;
    const { segmentBy, scope, ...criteria } = req.validatedQuery;

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: QUESTIONS_INCLUDE,
    });

    if (!survey) {
      const error = new Error('Enquête introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // ── Filtre « public analysé » (S5R-08) ──
    // On ne compte que les répondants dont le profil correspond aux
    // critères (même logique que le public visé, lib/audience.js) ; un
    // profil incomplet n'est JAMAIS rangé dans un groupe par défaut.
    const filterAudience = scope === 'target' ? audienceOf(survey) : criteria;
    if (scope !== 'all' && !isEveryone(filterAudience)) {
      return res.json(await computeFilteredResults(survey, scope, filterAudience));
    }

    const result = await computeResults(survey, { detailed: true });
    result.filter = { scope: 'all' };
    result.minGroupSize = MIN_GROUP_SIZE;

    if (segmentBy) {
      const segmentQuestion = survey.questions.find((q) => q.id === segmentBy);
      if (!segmentQuestion) {
        const error = new Error('Question de segmentation introuvable sur cette enquête');
        error.status = 400;
        error.code = 'INVALID_SEGMENT_QUESTION';
        throw error;
      }
      if (!['CHOIX_UNIQUE', 'OUI_NON'].includes(segmentQuestion.type)) {
        // CHOIX_MULTIPLE exclu volontairement : un même répondant
        // pourrait appartenir à PLUSIEURS segments à la fois, et les
        // effectifs de chaque segment ne s'additionneraient plus au
        // total général — trompeur pour un document destiné à la
        // mairie. CHOIX_UNIQUE et OUI_NON partagent la même propriété
        // qui rend la segmentation sûre : une seule réponse possible
        // par bulletin.
        const error = new Error('Seule une question à réponse UNIQUE (choix unique ou oui/non) peut servir à segmenter les résultats');
        error.status = 400;
        error.code = 'INVALID_SEGMENT_QUESTION';
        throw error;
      }

      // Une seule requête pour retrouver, PAR OPTION de la question de
      // segmentation, la liste des bulletins (responseId) concernés —
      // plutôt qu'une requête par option, qui multiplierait les
      // allers-retours base pour un nombre d'options pourtant réduit.
      const segmentAnswers = await prisma.answer.findMany({
        where: { questionId: segmentQuestion.id, optionId: { not: null } },
        select: { optionId: true, responseId: true },
      });
      const responseIdsByOption = new Map();
      for (const row of segmentAnswers) {
        if (!responseIdsByOption.has(row.optionId)) responseIdsByOption.set(row.optionId, []);
        responseIdsByOption.get(row.optionId).push(row.responseId);
      }

      result.segmentedBy = {
        questionId: segmentQuestion.id,
        questionLabel: segmentQuestion.label,
        // Renvoyé au client pour qu'il affiche la règle (« groupes de
        // moins de 5 personnes masqués ») sans la recoder en dur.
        minGroupSize: MIN_GROUP_SIZE,
        segments: await Promise.all(
          segmentQuestion.options.map(async (option) => {
            const responseIds = responseIdsByOption.get(option.id) || [];

            // Segment trop petit (1 à 4 bulletins) : on dit qu'il
            // existe, jamais combien il pèse ni ce qu'il a répondu —
            // voir lib/privacy.js. Aucune requête de résultats lancée.
            if (isTooSmall(responseIds.length)) {
              return {
                optionId: option.id,
                optionLabel: option.label,
                masked: true,
                totalResponses: null,
                questions: [],
              };
            }

            // Segment vide (personne n'a choisi cette option) : pas la
            // peine d'interroger la base pour un résultat qui sera de
            // toute façon entièrement à zéro.
            if (responseIds.length === 0) {
              return { optionId: option.id, optionLabel: option.label, masked: false, totalResponses: 0, questions: [] };
            }

            // detailed: false → PAS de texte libre brut par segment.
            // « Un texte + le fait d'être salarié·e de tel quartier »
            // suffit souvent à reconnaître quelqu'un ; le texte brut
            // reste consultable dans le résultat GLOBAL, jamais
            // recoupé avec un profil.
            const segmentResult = await computeResults(survey, { detailed: false, responseIds });
            return {
              optionId: option.id,
              optionLabel: option.label,
              masked: false,
              totalResponses: segmentResult.totalResponses,
              // Deuxième niveau de masquage : une question branchée
              // peut n'avoir été vue que par 2 personnes d'un segment
              // pourtant assez grand.
              questions: maskSmallQuestions(segmentResult.questions),
            };
          }),
        ),
      };
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}
function rejectAnswer(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  throw error;
}

// Valide UNE réponse par rapport à SA question (celle désignée par
// answer.questionId, déjà vérifiée comme appartenant à cette enquête
// par l'appelant) et retourne les lignes Answer à créer. Un tableau
// en retour, pas un objet : CHOIX_MULTIPLE peut produire plusieurs
// lignes pour une seule réponse (une ligne par option cochée).
function buildAnswerRows(question, answer, answersByQuestionId) {
  switch (question.type) {
    case 'CHOIX_UNIQUE':
    case 'OUI_NON': {
      if (!answer.optionId) {
        rejectAnswer(`« ${question.label} » attend une option unique (optionId)`);
      }
      const isValidOption = question.options.some((o) => o.id === answer.optionId);
      if (!isValidOption) {
        rejectAnswer(`L'option choisie n'appartient pas à la question « ${question.label} »`);
      }
      return [{ questionId: question.id, optionId: answer.optionId }];
    }

    case 'CHOIX_MULTIPLE': {
      if (!answer.optionIds || answer.optionIds.length === 0) {
        rejectAnswer(`« ${question.label} » attend au moins une option (optionIds)`);
      }
      const validIds = new Set(question.options.map((o) => o.id));
      for (const optionId of answer.optionIds) {
        if (!validIds.has(optionId)) {
          rejectAnswer(`Une option choisie n'appartient pas à la question « ${question.label} »`);
        }
      }
      // new Set() déduplique : cocher deux fois la même case dans le
      // payload ne doit pas créer deux lignes identiques en base (la
      // contrainte @@unique([responseId, questionId, optionId]) du
      // schéma le rejetterait de toute façon, mais autant l'éviter
      // proprement plutôt que de laisser Postgres lever une erreur).
      const uniqueOptionIds = [...new Set(answer.optionIds)];

      // S5R-05 : pas plus de cases que la réponse à une question
      // « Nombre » précédente (ex. lieux de stationnement ≤ véhicules).
      // Pas de réponse à cette question de référence → pas de limite.
      if (question.maxChoicesFromId) {
        const limit = answersByQuestionId.get(question.maxChoicesFromId)?.valueNumber;
        if (typeof limit === 'number' && uniqueOptionIds.length > limit) {
          rejectAnswer(`« ${question.label} » : ${limit} réponse${limit > 1 ? 's' : ''} au maximum`);
        }
      }

      return uniqueOptionIds.map((optionId) => ({ questionId: question.id, optionId }));
    }

    case 'NOMBRE': {
      if (typeof answer.valueNumber !== 'number') {
        rejectAnswer(`« ${question.label} » attend un nombre (valueNumber)`);
      }
      // S5R-05 : bornes fixées par l'administratrice (ex. au moins 1
      // véhicule professionnel quand on vient de répondre « Oui »)
      if (question.minValue !== null && answer.valueNumber < question.minValue) {
        rejectAnswer(`« ${question.label} » : la valeur doit être au moins ${question.minValue}`);
      }
      if (question.maxValue !== null && answer.valueNumber > question.maxValue) {
        rejectAnswer(`« ${question.label} » : la valeur doit être au plus ${question.maxValue}`);
      }
      return [{ questionId: question.id, valueNumber: answer.valueNumber }];
    }

    case 'TEXTE_LIBRE': {
      const text = answer.valueText?.trim();
      if (!text) {
        // Un texte libre vide n'est une erreur QUE si la question est
        // obligatoire — sinon "rien écrit" est une réponse valide.
        if (question.required) {
          rejectAnswer(`« ${question.label} » attend un texte (valueText)`);
        }
        return [];
      }
      return [{ questionId: question.id, valueText: text }];
    }

    default:
      // Ne devrait jamais arriver (l'enum QuestionType couvre tous
      // les cas) — filet de sécurité si le schéma évolue un jour.
      rejectAnswer(`Type de question non pris en charge : ${question.type}`);
  }
}

// ── POST /surveys/:id/responses — soumettre son bulletin (citoyen) ──
//
// Contrairement au vote (upsert, on peut changer d'avis), une réponse
// d'enquête ne se modifie pas : on répond UNE fois, point. D'où la
// vérification explicite + 409 plutôt qu'un upsert silencieux — la
// contrainte @@unique([userId, surveyId]) du schéma empêcherait de
// toute façon un doublon, mais un upsert masquerait qu'il y avait
// déjà une réponse, ce qui serait trompeur pour un questionnaire
// (le citoyen doit savoir qu'il a déjà participé, pas juste voir sa
// nouvelle réponse silencieusement ignorée ou fusionnée).
export async function submitResponse(req, res, next) {
  try {
    const { id: surveyId } = req.params;
    const { answers } = req.body;
    const userId = req.user.userId;

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      // conditions : nécessaires pour rejouer le parcours (S5R-05)
      include: { questions: { include: { options: true, conditions: { select: { optionId: true } } } } },
    });

    if (!survey) {
      const error = new Error('Enquête introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const now = new Date();
    const isClosed = survey.status !== 'OPEN'
      || (survey.opensAt && survey.opensAt > now)
      || (survey.closesAt && survey.closesAt < now);

    if (isClosed) {
      const error = new Error("Cette enquête n'est pas ouverte aux réponses actuellement");
      error.status = 403;
      error.code = 'SURVEY_CLOSED';
      throw error;
    }

    // 409 vérifié AVANT de valider le détail des réponses : inutile
    // de faire tout le travail de validation si la personne a de
    // toute façon déjà répondu.
    const alreadyResponded = await prisma.surveyResponse.findUnique({
      where: { userId_surveyId: { userId, surveyId } },
    });
    if (alreadyResponded) {
      const error = new Error('Vous avez déjà répondu à cette enquête');
      error.status = 409;
      error.code = 'ALREADY_RESPONDED';
      throw error;
    }

    // Chaque questionId envoyé doit appartenir à CETTE enquête — sans
    // ce contrôle, rien n'empêcherait (erreur de front, ou appel API
    // direct) de glisser la réponse à la question d'une AUTRE enquête.
    const questionsById = new Map(survey.questions.map((q) => [q.id, q]));
    for (const answer of answers) {
      if (!questionsById.has(answer.questionId)) {
        rejectAnswer(`La question ${answer.questionId} n'appartient pas à cette enquête`);
      }
    }

    const answersByQuestionId = new Map(answers.map((a) => [a.questionId, a]));

    // On parcourt les QUESTIONS de l'enquête (pas les réponses reçues) :
    // c'est le seul sens qui permet de détecter une question OBLIGATOIRE
    // restée sans réponse — l'inverse (parcourir les réponses) ne
    // remarquerait jamais une absence.
    // S5R-05 : on REJOUE le parcours de la personne avec le même moteur
    // que le questionnaire (lib/surveyFlow.js) — conditions multiples
    // (OU) et fins anticipées compris. Seules les questions qu'elle a
    // réellement VUES comptent : obligatoires pour elle, et seules leurs
    // réponses sont enregistrées (une réponse à une question qu'elle n'a
    // pas pu voir est ignorée).
    const flowQuestions = survey.questions.map(withConditionIds);
    const chosenOptionIds = (questionId) => {
      const a = answersByQuestionId.get(questionId);
      return a?.optionIds ?? (a?.optionId ? [a.optionId] : []);
    };
    const visibleIds = visibleQuestionIds(flowQuestions, chosenOptionIds);

    const answerRows = [];
    for (const questionId of visibleIds) {
      const question = questionsById.get(questionId);
      const answer = answersByQuestionId.get(question.id);

      if (!answer) {
        if (question.required) {
          rejectAnswer(`La question « ${question.label} » est obligatoire`);
        }
        continue; // question optionnelle non répondue : rien à créer
      }

      answerRows.push(...buildAnswerRows(question, answer, answersByQuestionId));
    }

    // $transaction : le bulletin (SurveyResponse) et TOUTES ses lignes
    // de réponse (Answer) doivent être créés ENSEMBLE ou pas du tout —
    // un crash au milieu ne doit jamais laisser un bulletin à moitié
    // rempli en base (le fameux "tout ou rien" du ticket).
    let response;
    try {
      response = await prisma.$transaction(async (tx) => {
        const surveyResponse = await tx.surveyResponse.create({
          data: { surveyId, userId },
        });

        await tx.answer.createMany({
          data: answerRows.map((row) => ({ ...row, responseId: surveyResponse.id })),
        });

        return surveyResponse;
      });
    } catch (txErr) {
      // P2002 = contrainte unique (userId, surveyId) violée — la
      // vérification alreadyResponded ci-dessus élimine le cas
      // séquentiel, mais deux requêtes strictement SIMULTANÉES
      // peuvent toutes les deux passer cette vérification avant que
      // l'une des deux n'écrive réellement en base (la vraie course
      // critique). Sans ce rattrapage, cette seconde requête
      // remontait un 500 générique au lieu du même 409 que le cas
      // séquentiel — la base protège bien contre le doublon, mais la
      // réponse HTTP mentait sur la raison de l'échec.
      if (txErr.code === 'P2002') {
        const error = new Error('Vous avez déjà répondu à cette enquête');
        error.status = 409;
        error.code = 'ALREADY_RESPONDED';
        throw error;
      }
      throw txErr;
    }

    // Synchronisation profil (S5-XX) : pour chaque question flaguée
    // syncsToProfile, si le répondant a choisi une option avec un
    // syncValue, ce champ du COMPTE est mis à jour en plus du
    // bulletin lui-même — jamais à sa place. Volontairement APRÈS la
    // transaction ci-dessus : le bulletin est la donnée qui compte
    // vraiment pour l'enquête, un souci sur la synchro du profil ne
    // doit jamais faire échouer la soumission elle-même.
    const profileUpdate = {};
    const visibleSet = new Set(visibleIds);
    for (const question of survey.questions) {
      // Seules les questions VUES par la personne mettent à jour son profil
      if (!question.syncsToProfile || !visibleSet.has(question.id)) continue;
      const answer = answersByQuestionId.get(question.id);
      if (!answer?.optionId) continue;
      const option = question.options.find((o) => o.id === answer.optionId);
      if (!option?.syncValue) continue;
      // S5R-05 : « travaille à Senlis » est un oui/non (booléen) ; les
      // options portent les textes 'true' / 'false', convertis ici
      profileUpdate[question.syncsToProfile] = question.syncsToProfile === 'travailleASenlis'
        ? option.syncValue === 'true'
        : option.syncValue;
    }
    // Cohérence du volet « travail » : « non » efface le quartier et le
    // rôle de travail ; un quartier de travail donné implique « oui »
    if (profileUpdate.travailleASenlis === false) {
      profileUpdate.travailleQuartier = null;
      profileUpdate.travailType = null;
    }
    if (profileUpdate.travailleQuartier) profileUpdate.travailleASenlis = true;
    // Même garde-fou que updateProfile (authController.js) : si la
    // situation change pour autre chose qu'AUTRE_QUARTIER SANS que
    // cette même enquête ne resynchronise aussi le quartier, l'ancien
    // quartier n'aurait plus de sens et resterait périmé en base.
    if (profileUpdate.situation && profileUpdate.situation !== 'AUTRE_QUARTIER' && !profileUpdate.quartier) {
      profileUpdate.quartier = null;
    }
    if (Object.keys(profileUpdate).length) {
      await prisma.user.update({ where: { id: userId }, data: profileUpdate }).catch((err) => {
        // Une erreur ici (ex. valeur invalide malgré la validation
        // Zod côté création d'enquête) ne doit jamais faire échouer
        // une soumission par ailleurs valide — juste consignée.
        console.error('Échec de la synchronisation profil après soumission :', err);
      });
    }

    res.status(201).json({
      response: { id: response.id, submittedAt: response.submittedAt },
    });
  } catch (err) {
    next(err);
  }
}
