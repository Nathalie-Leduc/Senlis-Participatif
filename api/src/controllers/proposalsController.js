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

// ── Agrégat des votes — pour PLUSIEURS propositions à la fois ──
//
// Pourquoi "plusieurs" et pas "une seule" ? La liste publique affiche
// une jauge de vote sur CHAQUE carte (voir wireframe). Si on appelait
// une requête par proposition, une page de 10 cartes ferait 10 allers-
// retours vers Postgres. Ici, UNE requête groupée couvre toute la page.
//
// Analogie : plutôt que d'appeler chaque table du restaurant une par
// une pour demander l'addition, le serveur fait un seul passage et
// note tout d'un coup.
async function getVoteAggregatesForMany(proposalIds) {
  if (proposalIds.length === 0) return {};

  const rawCounts = await prisma.vote.groupBy({
    by: ['proposalId', 'value'],
    where: { proposalId: { in: proposalIds } },
    _count: true,
  });

  // On initialise à 0 pour TOUTES les propositions demandées — sinon
  // une proposition sans aucun vote n'apparaîtrait pas du tout dans
  // le résultat, et le front devrait deviner qu'"absent" veut dire 0.
  const map = {};
  for (const id of proposalIds) {
    map[id] = { POUR: 0, CONTRE: 0, NEUTRE: 0 };
  }
  for (const { proposalId, value, _count } of rawCounts) {
    map[proposalId][value] = _count;
  }
  return map;
}

// Version "une seule proposition" — un simple raccourci au-dessus de
// la version batch, pour ne pas dupliquer la logique de groupBy.
async function getVoteAggregate(proposalId) {
  const map = await getVoteAggregatesForMany([proposalId]);
  return map[proposalId];
}

// ── Règle métier partagée : le vote est-il encore ouvert ? ──
//
// Utilisée par castVote ET removeVote — on ne devrait pas pouvoir
// retirer un vote après clôture, pas plus qu'en ajouter un.
function assertVotingOpen(proposal) {
  if (!proposal) {
    const error = new Error('Proposition introuvable');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const closed = proposal.status !== 'PUBLISHED'
    || (proposal.closesAt && proposal.closesAt < new Date());

  if (closed) {
    const error = new Error('Les votes sont clos pour cette proposition');
    error.status = 403;
    error.code = 'VOTES_CLOSED';
    throw error;
  }
}

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

// ── GET /proposals/admin — liste ADMIN, tous statuts confondus ─
//
// Contrairement à list() (public), celle-ci ne filtre JAMAIS sur
// VISIBLE_STATUSES — un admin doit retrouver ses brouillons pour
// pouvoir les éditer ou les publier. C'est la "réserve du magasin",
// pas la vitrine.
export async function listAdmin(req, res, next) {
  try {
    const { page, limit, status } = req.validatedQuery;

    const where = status ? { status } : {}; // pas de filtre = tout voir

    const [items, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' }, // les plus récemment créées d'abord, brouillons inclus
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.proposal.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /proposals — liste paginée, publique ────────────
export async function list(req, res, next) {
  try {
    const { page, limit, status, sort } = req.validatedQuery;

    // Si un statut précis est demandé (PUBLISHED ou CLOSED, jamais
    // autre chose — voir listProposalsQuerySchema), on filtre dessus.
    // Sinon, "toutes" veut dire "toutes celles que le public peut voir".
    const where = { status: status || { in: VISIBLE_STATUSES } };

    // Deux tris possibles : les plus récentes d'abord (par défaut),
    // ou les plus votées d'abord. Prisma sait trier directement sur
    // le NOMBRE d'éléments d'une relation (votes: { _count: ... }),
    // donc le tri se fait en base, pas en mémoire côté Node — important
    // puisque skip/take doivent porter sur le même ordre.
    const orderBy = sort === 'votes'
      ? { votes: { _count: 'desc' } }
      : { publishedAt: 'desc' };

    const [items, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        select: LIST_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.proposal.count({ where }),
    ]);

    // Une seule requête groupée pour les votes de TOUTE la page
    // (voir getVoteAggregatesForMany plus haut).
    const votesByProposal = await getVoteAggregatesForMany(items.map((p) => p.id));
    const itemsWithVotes = items.map((p) => ({
      ...p,
      votes: votesByProposal[p.id],
    }));

    res.json({
      items: itemsWithVotes,
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

    // Un visiteur normal ne voit QUE PUBLISHED/CLOSED — mais un admin
    // doit pouvoir consulter (et donc éditer) un brouillon, sans quoi
    // le formulaire d'édition n'aurait aucun moyen de charger les
    // données existantes d'une proposition pas encore publiée.
    // req.user n'existe que si optionalAuth a trouvé un JWT valide
    // (voir middlewares/auth.js) — un visiteur anonyme n'a pas ce
    // passe-droit, quoi qu'il arrive.
    const isAdmin = req.user?.role === 'ADMIN';

    if (!proposal || (!VISIBLE_STATUSES.includes(proposal.status) && !isAdmin)) {
      const error = new Error('Proposition introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // groupBy compte les votes par valeur en une seule requête agrégée
    // — voir getVoteAggregate() plus haut, réutilisée par castVote/removeVote.
    const votes = await getVoteAggregate(proposal.id);

    // req.user n'existe QUE si optionalAuth a trouvé un JWT valide
    // (voir middlewares/auth.js). Un visiteur anonyme n'a pas de
    // myVote dans la réponse — le front traite "absent" comme
    // "n'a pas encore voté", ce qui est la vérité dans ce cas.
    let myVote = null;
    if (req.user) {
      const vote = await prisma.vote.findUnique({
        where: { userId_proposalId: { userId: req.user.userId, proposalId: proposal.id } },
        select: { value: true },
      });
      myVote = vote?.value || null;
    }

    res.json({ proposal, votes, myVote });
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

// ── PUT /proposals/:id/vote — voter ou changer d'avis (upsert) ─
export async function castVote(req, res, next) {
  try {
    const { id: proposalId } = req.params;
    const { value } = req.body;
    const userId = req.user.userId;

    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    assertVotingOpen(proposal); // lève 404 ou 403 VOTES_CLOSED si besoin

    // upsert = "crée si ça n'existe pas, sinon met à jour" — c'est
    // ce qui permet à un citoyen de changer d'avis (POUR → CONTRE)
    // en un seul appel, sans jamais dupliquer de ligne. La contrainte
    // @@unique([userId, proposalId]) du schéma garantit qu'aucun
    // appel concurrent (double clic, deux onglets) ne peut créer
    // deux votes pour la même personne — PostgreSQL, pas le JS.
    //
    // Le nom "userId_proposalId" est celui que Prisma génère
    // automatiquement pour la clé composée déclarée dans schema.prisma
    // via @@unique([userId, proposalId]) — dans cet ordre précis.
    await prisma.vote.upsert({
      where: { userId_proposalId: { userId, proposalId } },
      create: { userId, proposalId, value },
      update: { value },
    });

    const votes = await getVoteAggregate(proposalId);
    res.json({ votes });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /proposals/:id/vote — retirer son vote ───────
export async function removeVote(req, res, next) {
  try {
    const { id: proposalId } = req.params;
    const userId = req.user.userId;

    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    assertVotingOpen(proposal);

    const existing = await prisma.vote.findUnique({
      where: { userId_proposalId: { userId, proposalId } },
    });

    if (!existing) {
      const error = new Error('Aucun vote à retirer sur cette proposition');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    await prisma.vote.delete({ where: { userId_proposalId: { userId, proposalId } } });

    const votes = await getVoteAggregate(proposalId);
    res.json({ votes });
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
