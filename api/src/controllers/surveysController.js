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
  return questions.map((q, index) => ({
    label: q.label,
    helpText: q.helpText,
    type: q.type,
    required: q.required ?? true,
    order: index,
    options: q.options
      ? { create: q.options.map((o, optionIndex) => ({ label: o.label, order: optionIndex })) }
      : undefined,
  }));
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

    res.json({ survey });
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
