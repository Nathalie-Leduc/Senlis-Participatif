// ══════════════════════════════════════════════════════════
// Contrôleur Propositions — CRUD admin + consultation publique
//
// Deux publics bien distincts pour les mêmes données :
// - Le visiteur/citoyen ne voit QUE les propositions "sorties
//   de cuisine" (PUBLISHED ou CLOSED) — jamais un brouillon.
// - L'administratrice, via les routes 👑, peut tout créer/éditer,
//   y compris changer le statut d'une proposition (le seul moyen
//   de la faire passer de DRAFT à PUBLISHED, donc de la rendre
//   visible).
//
// Analogie : DRAFT/PENDING_REVIEW/REJECTED sont "en cuisine" —
// seule l'équipe y a accès. PUBLISHED et CLOSED sont "en salle" —
// tout le monde peut les consulter, encore chaudes (PUBLISHED,
// on peut voter) ou déjà servies (CLOSED, résultats figés).
// ══════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';
import { generateUniqueSlug } from '../lib/slug.js';

// Statuts visibles sans authentification — jamais DRAFT,
// PENDING_REVIEW, REJECTED ou ARCHIVED côté public.
const VISIBLE_STATUSES = ['PUBLISHED', 'CLOSED'];

// Champs renvoyés dans la LISTE publique — volontairement plus
// légers que le détail (pas de "content", potentiellement long,
// ni de geoJson qui peut peser plusieurs Ko par proposition).
const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  status: true,
  lat: true,
  lng: true,
  publishedAt: true,
  closesAt: true,
};

// ── GET /proposals — liste paginée, publique ────────────
export async function list(req, res, next) {
  try {
    const { page, limit } = req.validatedQuery;

    // Deux requêtes en parallèle : les résultats de la page +
    // le total pour calculer le nombre de pages côté front.
    const [items, total] = await Promise.all([
      prisma.proposal.findMany({
        where: { status: { in: VISIBLE_STATUSES } },
        select: LIST_SELECT,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.proposal.count({
        where: { status: { in: VISIBLE_STATUSES } },
      }),
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /proposals/:slug — détail + agrégat des votes ───
export async function getBySlug(req, res, next) {
  try {
    const { slug } = req.params;

    const proposal = await prisma.proposal.findUnique({ where: { slug } });

    // Une proposition DRAFT existe en BDD mais n'existe pas pour
    // le public — on renvoie 404, jamais 403 : sinon un visiteur
    // saurait qu'un brouillon existe à cette adresse, juste caché.
    if (!proposal || !VISIBLE_STATUSES.includes(proposal.status)) {
      const error = new Error('Proposition introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // groupBy compte les votes par valeur (POUR/CONTRE/NEUTRE) en
    // UNE requête agrégée en base, plutôt que de rapatrier tous
    // les votes en mémoire pour les compter côté Node.
    const rawCounts = await prisma.vote.groupBy({
      by: ['value'],
      where: { proposalId: proposal.id },
      _count: true,
    });

    // On garantit les 3 clés même à 0 vote — plus simple à
    // consommer côté front qu'un objet qui pourrait manquer
    // "NEUTRE" si personne n'a encore voté neutre.
    const votes = { POUR: 0, CONTRE: 0, NEUTRE: 0 };
    for (const { value, _count } of rawCounts) {
      votes[value] = _count;
    }

    res.json({ proposal, votes });
  } catch (err) {
    next(err);
  }
}

// ── POST /proposals — créer (admin) ─────────────────────
export async function create(req, res, next) {
  try {
    const { title, summary, content, status, lat, lng, geoJson, closesAt } = req.body;

    const slug = await generateUniqueSlug(title, prisma.proposal);

    // Si l'admin publie directement à la création, publishedAt
    // se pose maintenant — c'est la même règle qu'à l'édition
    // (voir update()), factorisée dans resolvePublishedAt().
    const publishedAt = resolvePublishedAt(status, null);

    const proposal = await prisma.proposal.create({
      data: {
        slug,
        title,
        summary,
        content,
        status: status || 'DRAFT',
        lat,
        lng,
        geoJson,
        closesAt,
        publishedAt,
        authorId: req.user.userId,
      },
    });

    res.status(201).json({ proposal });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /proposals/:id — éditer / changer de statut (admin) ─
export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });

    if (!existing) {
      const error = new Error('Proposition introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const publishedAt = resolvePublishedAt(req.body.status, existing.publishedAt);

    const proposal = await prisma.proposal.update({
      where: { id },
      data: { ...req.body, ...(publishedAt !== undefined && { publishedAt }) },
    });

    res.json({ proposal });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /proposals/:id — supprimer (admin) ───────────
export async function remove(req, res, next) {
  try {
    const { id } = req.params;

    // Prisma lève P2025 si l'id n'existe pas déjà — errorHandler
    // le renverrait en 500 (pas idéal). On vérifie donc explicitement
    // AVANT, pour renvoyer un vrai 404 informatif.
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Proposition introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    await prisma.proposal.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ── Règle métier partagée : quand fixer publishedAt ? ───
//
// La première fois qu'une proposition passe au statut PUBLISHED,
// on fige la date. Si elle est déjà PUBLISHED (ou l'a déjà été),
// on ne touche plus à cette date — republier ne doit pas effacer
// "depuis quand" le public en discute.
//
// @param {string|undefined} newStatus - le statut envoyé dans la requête (peut être absent)
// @param {Date|null} currentPublishedAt - la valeur déjà en BDD
// @returns {Date|undefined} une nouvelle date à écrire, ou undefined = "ne pas toucher au champ"
function resolvePublishedAt(newStatus, currentPublishedAt) {
  if (newStatus === 'PUBLISHED' && !currentPublishedAt) {
    return new Date();
  }
  return undefined;
}
