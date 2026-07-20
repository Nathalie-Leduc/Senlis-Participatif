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

const VISIBLE_STATUSES = ['OPEN', 'CLOSED'];

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  audience: true,
  status: true,
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
      options: options
        ? { create: options.map((o, optionIndex) => ({ label: o.label, order: optionIndex })) }
        : undefined,
    };
  });
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

    const survey = await prisma.survey.create({
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
      include: QUESTIONS_INCLUDE,
    });

    res.status(201).json({ survey });
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
    const existing = await prisma.survey.findUnique({ where: { id } });

    if (!existing) {
      const error = new Error('Enquête introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const { questions, ...surveyFields } = req.body;

    // Garde-fou : Question a onDelete: Cascade vers Answer (voir
    // schema.prisma). Remplacer les questions d'une enquête qui a
    // déjà reçu des réponses effacerait ces réponses sans prévenir —
    // même logique de prudence que RGPD/onDelete ailleurs dans ce
    // projet. On bloque plutôt que de détruire silencieusement des
    // données de citoyens.
    if (questions) {
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
      if (questions) {
        // Cascade se charge des QuestionOption liées.
        await tx.question.deleteMany({ where: { surveyId: id } });
      }

      return tx.survey.update({
        where: { id },
        data: {
          ...surveyFields,
          ...(questions && { questions: { create: toNestedQuestionsCreate(questions) } }),
        },
        include: QUESTIONS_INCLUDE,
      });
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

    const totalResponses = await prisma.surveyResponse.count({
      where: { surveyId: survey.id },
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

    // Promise.all : les trois familles de groupBy sont indépendantes,
    // pas besoin d'attendre l'une pour lancer l'autre. Un tableau vide
    // en `where.questionId.in` renverrait de toute façon [] — le if
    // évite juste une requête Postgres inutile quand une enquête n'a
    // aucune question de ce type-là.
    const [optionCounts, numberStats, textCounts] = await Promise.all([
      choiceQuestionIds.length
        ? prisma.answer.groupBy({
          by: ['questionId', 'optionId'],
          where: { questionId: { in: choiceQuestionIds }, optionId: { not: null } },
          _count: true,
        })
        : [],
      numberQuestionIds.length
        ? prisma.answer.groupBy({
          by: ['questionId'],
          where: { questionId: { in: numberQuestionIds } },
          _count: { valueNumber: true },
          _avg: { valueNumber: true },
          _min: { valueNumber: true },
          _max: { valueNumber: true },
        })
        : [],
      textQuestionIds.length
        ? prisma.answer.groupBy({
          by: ['questionId'],
          where: { questionId: { in: textQuestionIds } },
          _count: { valueText: true },
        })
        : [],
    ]);

    // Index par questionId pour un accès direct au moment d'assembler
    // le résultat final, plutôt que de re-scanner ces tableaux pour
    // chaque question de l'enquête (Map imbriquée pour les options :
    // question → option → compte).
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

    const questions = survey.questions.map((question) => {
      const base = {
        id: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
      };

      if (AGGREGATABLE_CHOICE_TYPES.includes(question.type)) {
        const countsForQuestion = optionCountsByQuestion.get(question.id);
        // Toutes les options à 0 par défaut — sinon une option jamais
        // choisie n'apparaîtrait pas du tout dans le résultat, et le
        // front devrait deviner qu'"absente" veut dire 0 (même logique
        // que getVoteAggregatesForMany pour les propositions).
        const options = question.options.map((option) => {
          const count = countsForQuestion?.get(option.id) || 0;
          return {
            id: option.id,
            label: option.label,
            count,
            percentage: totalResponses > 0
              ? Math.round((count / totalResponses) * 1000) / 10
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

      // TEXTE_LIBRE : pas de contenu brut exposé par ce point d'entrée
      // public — juste combien de personnes ont répondu. Consulter les
      // réponses complètes reste une fonctionnalité admin à part,
      // hors périmètre de ce ticket.
      return { ...base, totalAnswered: textCountsByQuestion.get(question.id) || 0 };
    });

    res.json({
      survey: { id: survey.id, slug: survey.slug, title: survey.title, status: survey.status },
      totalResponses,
      questions,
    });
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
    const response = await prisma.$transaction(async (tx) => {
      const surveyResponse = await tx.surveyResponse.create({
        data: { surveyId, userId },
      });

      await tx.answer.createMany({
        data: answerRows.map((row) => ({ ...row, responseId: surveyResponse.id })),
      });

      return surveyResponse;
    });

    res.status(201).json({
      response: { id: response.id, submittedAt: response.submittedAt },
    });
  } catch (err) {
    next(err);
  }
}
