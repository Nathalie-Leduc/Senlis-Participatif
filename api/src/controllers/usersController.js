// ══════════════════════════════════════════════════════════
// Gestion des comptes — admin uniquement
//
// Volontairement minimal pour l'instant (S5-XX) : juste de quoi
// promouvoir un citoyen en admin (ex. faire tester un proche) sans
// devoir toucher à la base à la main. La vraie hiérarchie de rôles
// (salarié mairie, maison de quartier, délégués...) est un chantier
// à part, plus large — voir le backlog non planifié du kanban.
// ══════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';

const LIST_SELECT = {
  id: true,
  email: true,
  pseudo: true,
  role: true,
  emailVerified: true,
  createdAt: true,
};

// ── GET /admin/users — liste paginée, avec recherche ─────
export async function list(req, res, next) {
  try {
    const { page, limit, search } = req.validatedQuery;

    const where = search
      ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { pseudo: { contains: search, mode: 'insensitive' } },
        ],
      }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /admin/users/:id — changer le rôle ─────────────
//
// Un seul garde-fou suffit : impossible de se rétrograder soi-même.
// Ça peut sembler court, mais c'est mathématiquement complet — seul
// un admin authentifié peut appeler cette route (middleware isAdmin),
// et rétrograder un AUTRE compte laisse toujours l'auteur de la
// requête lui-même admin après coup. Le nombre total d'admins ne
// peut donc jamais tomber à zéro : soit la cible est soi-même
// (bloqué ici), soit c'est quelqu'un d'autre (l'auteur reste admin).
// Un second garde-fou "dernier admin restant" avait été ajouté par
// prudence, mais était en réalité inatteignable — si adminCount vaut
// 1, la seule personne capable d'appeler cette route EST ce dernier
// admin, donc target === soi-même, et on retombe toujours sur le cas
// ci-dessus en premier. Retiré pour ne pas laisser du code mort
// suggérer une protection qui ne s'exécute jamais.
export async function updateRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (id === req.user.userId && role !== 'ADMIN') {
      const error = new Error('Impossible de vous rétrograder vous-même');
      error.status = 400;
      error.code = 'CANNOT_DEMOTE_SELF';
      throw error;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: LIST_SELECT,
    });

    res.json({ user });
  } catch (err) {
    if (err.code === 'P2025') {
      const error = new Error('Compte introuvable');
      error.status = 404;
      error.code = 'NOT_FOUND';
      return next(error);
    }
    next(err);
  }
}
