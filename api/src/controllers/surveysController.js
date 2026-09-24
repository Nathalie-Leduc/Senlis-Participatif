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
import { generateUniqueSlug } from '../lib/slug.js';
import { MIN_GROUP_SIZE, isTooSmall, maskSmallQuestions } from '../lib/privacy.js';

const VISIBLE_STATUSES = ['OPEN', 'CLOSED'];

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  audience: true,
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
    include: { options: { orderBy: { order: 'asc' } } },
  },
};

// Transforme le tableau "questions" reçu du client (Zod) en nested
// write Prisma. Réutilisée par create() ET update() pour ne pas
// dupliquer la même transformation à deux endroits.
//
// order = index dans le tableau, jamais une valeur envoyée par le
// client : ça élimine toute une classe d'erreurs (doublons, trous,
// ordres qui ne commencent pas à 0) sans avoir à les valider.
function toNestedQuestionsCreate(questions) {
  return questions.map((q, index) => {
    // OUI_NON a besoin de 2 options pour fonctionner (voir Answer
    // dans schema.prisma), mais on ne veut pas obliger l'admin à
    // taper "Oui"/"Non" à chaque fois — seulement s'il veut les
    // personnaliser (ex. "Oui, systématiquement" / "Non, jamais").
    const options = q.options
      ?? (q.type === 'OUI_NON' ? [{ label: 'Oui' }, { label: 'Non' }] : undefined);

    return {
      label: q.label,
      helpText: q.helpText,
      type: q.type,
      required: q.required ?? true,
      order: index,
      uiHint: q.uiHint,
      syncsToProfile: q.syncsToProfile,
      options: options
        ? { create: options.map((o, optionIndex) => ({ label: o.label, order: optionIndex, syncValue: o.syncValue })) }
        : undefined,
    };
  });
}

// ── Résolution du branchement conditionnel (showIf) ─────
//
// Le nested create ci-dessus ne peut PAS poser showIfOptionId :
// au moment où Prisma construit la requête, les options n'ont pas
// encore d'id — elles sont créées dans la MÊME requête. On résout
// donc les références par POSITION (order) dans un second passage,
// une fois les vrais id générés et connus.
async function resolveBranching(tx, surveyId, inputQuestions) {
  const hasBranching = inputQuestions.some((q) => q.showIf);
  if (!hasBranching) return;

  const createdQuestions = await tx.question.findMany({
    where: { surveyId },
    include: { options: true },
    orderBy: { order: 'asc' },
  });

  for (const [index, inputQuestion] of inputQuestions.entries()) {
    if (!inputQuestion.showIf) continue;

    // Une question ne peut dépendre que d'une question qui la
    // PRÉCÈDE — jamais d'elle-même ni d'une question plus tardive
    // (le répondant n'aurait pas encore répondu à celle-ci).
    if (inputQuestion.showIf.questionOrder >= index) {
      const error = new Error(
        `La question ${index + 1} ne peut dépendre que d'une question qui la précède`,
      );
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const targetQuestion = createdQuestions.find((q) => q.order === inputQuestion.showIf.questionOrder);
    const targetOption = targetQuestion?.options.find((o) => o.order === inputQuestion.showIf.optionOrder);
    const thisQuestion = createdQuestions[index];

    if (!targetOption || !thisQuestion) {
      const error = new Error(`Référence de branchement invalide pour la question ${index + 1}`);
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    await tx.question.update({
      where: { id: thisQuestion.id },
      data: { showIfOptionId: targetOption.id },
    });
  }
}

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
      items,
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
      items,
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

    res.json({ survey, hasResponded });
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
          audience: audience || 'TOUS',
          status: status || 'DRAFT',
          opensAt,
          closesAt,
          questions: { create: toNestedQuestionsCreate(questions) },
        },
      });

      await resolveBranching(tx, created.id, questions);

      return tx.survey.findUnique({ where: { id: created.id }, include: QUESTIONS_INCLUDE });
    });

    res.status(201).json({ survey });
  } catch (err) {
    next(err);
  }
}

// Compare les questions déjà en base à celles reçues dans la requête,
// pour savoir si l'admin a RÉELLEMENT touché aux questions ou si le
// formulaire renvoie juste, sans y toucher, ce qui était déjà là (le
// constructeur envoie toujours l'état complet, même quand seul le
// statut a changé — voir plus bas). Ignore délibérément les id (le
// payload entrant n'en a pas) : seuls label/type/required/order et
// les libellés d'options comptent pour dire "pareil" ou "différent".
function questionsUnchanged(existingQuestions, incomingQuestions) {
  if (existingQuestions.length !== incomingQuestions.length) return false;

  return existingQuestions.every((existingQuestion, index) => {
    const incoming = incomingQuestions[index];

    if (existingQuestion.label !== incoming.label) return false;
    if ((existingQuestion.helpText || '') !== (incoming.helpText || '')) return false;
    if (existingQuestion.type !== incoming.type) return false;
    if (existingQuestion.required !== (incoming.required ?? true)) return false;

    const existingLabels = existingQuestion.options.map((o) => o.label);
    // OUI_NON sans options fournies = "garder les options actuelles"
    // (même contrat qu'à la création) — pas une vraie différence.
    const incomingLabels = incoming.options?.length
      ? incoming.options.map((o) => o.label)
      : (existingQuestion.type === 'OUI_NON' ? existingLabels : []);

    if (existingLabels.length !== incomingLabels.length) return false;
    return existingLabels.every((label, i) => label === incomingLabels[i]);
  });
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

    const { questions, ...surveyFields } = req.body;

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
          ...(questionsActuallyChanged && { questions: { create: toNestedQuestionsCreate(questions) } }),
        },
      });

      if (questionsActuallyChanged) {
        await resolveBranching(tx, id, questions);
      }

      return tx.survey.findUnique({ where: { id }, include: QUESTIONS_INCLUDE });
    });

    res.json({ survey });
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

  const [optionCounts, numberStats, textCounts, rawTextAnswers, situationCounts] = await Promise.all([
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
    // Situation déclarée des répondants — pour confronter à
    // Survey.audience (revue du cahier des charges, point 3).
    // Uniquement pour la vue admin détaillée : la répartition des
    // situations des AUTRES citoyens n'a rien à faire dans une vue
    // publique.
    detailed
      ? prisma.surveyResponse.findMany({
        where: responseIds ? { id: { in: responseIds } } : { surveyId: survey.id },
        select: { user: { select: { situation: true } } },
      })
      : [],
  ]);

  // Map à plat questionId+optionId → compte (nested) ET optionId seul
  // → compte (flat) — la version flat sert à retrouver combien de
  // personnes ont vu une question BRANCHÉE (celles qui ont choisi
  // l'option qui la déclenche), sans avoir à savoir à quelle question
  // cette option appartient.
  const optionCountsByQuestion = new Map();
  const countByOptionId = new Map();
  for (const row of optionCounts) {
    if (!optionCountsByQuestion.has(row.questionId)) {
      optionCountsByQuestion.set(row.questionId, new Map());
    }
    optionCountsByQuestion.get(row.questionId).set(row.optionId, row._count);
    countByOptionId.set(row.optionId, row._count);
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

  const questions = survey.questions.map((question) => {
    // Une question SANS branchement est vue par tout le monde : le
    // dénominateur reste totalResponses, comme avant. Une question
    // BRANCHÉE n'a été vue que par les répondants ayant choisi
    // l'option qui la déclenche — utiliser totalResponses comme
    // dénominateur ferait paraître ses pourcentages artificiellement
    // bas (ex. 12 % au lieu de 80 % si seul un quart des répondants
    // pouvait même voir la question).
    const questionTotal = question.showIfOptionId
      ? (countByOptionId.get(question.showIfOptionId) || 0)
      : totalResponses;

    const base = {
      id: question.id,
      label: question.label,
      type: question.type,
      required: question.required,
      showIfOptionId: question.showIfOptionId,
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
    result.audience = survey.audience;
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
    const { segmentBy } = req.query;

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

    const result = await computeResults(survey, { detailed: true });

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
function buildAnswerRows(question, answer) {
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
      return uniqueOptionIds.map((optionId) => ({ questionId: question.id, optionId }));
    }

    case 'NOMBRE': {
      if (typeof answer.valueNumber !== 'number') {
        rejectAnswer(`« ${question.label} » attend un nombre (valueNumber)`);
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
      include: { questions: { include: { options: true } } },
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
    const answerRows = [];
    for (const question of survey.questions) {
      // Question conditionnelle (showIfOptionId) jamais montrée au
      // répondant : on cherche si l'option qui la déclenche a été
      // choisie PARMI TOUTES les réponses soumises — inutile de
      // connaître l'ordre des questions pour ça, l'id de l'option
      // suffit à lui seul à retrouver la question qui la possède.
      const gateSatisfied = !question.showIfOptionId
        || answers.some((a) => a.optionId === question.showIfOptionId
          || a.optionIds?.includes(question.showIfOptionId));

      if (!gateSatisfied) continue; // jamais montrée : ni obligatoire, ni sa réponse éventuelle prise en compte

      const answer = answersByQuestionId.get(question.id);

      if (!answer) {
        if (question.required) {
          rejectAnswer(`La question « ${question.label} » est obligatoire`);
        }
        continue; // question optionnelle non répondue : rien à créer
      }

      answerRows.push(...buildAnswerRows(question, answer));
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
    for (const question of survey.questions) {
      if (!question.syncsToProfile) continue;
      const answer = answersByQuestionId.get(question.id);
      if (!answer?.optionId) continue;
      const option = question.options.find((o) => o.id === answer.optionId);
      if (option?.syncValue) profileUpdate[question.syncsToProfile] = option.syncValue;
    }
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
