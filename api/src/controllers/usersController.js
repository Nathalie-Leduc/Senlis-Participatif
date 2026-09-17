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
// Deux garde-fous pour ne jamais se retrouver bloqué·e hors de son
// propre site : impossible de se rétrograder soi-même, et impossible
// de rétrograder le DERNIER admin restant (même si ce n'est pas
// soi-même — ex. un autre admin qui tenterait de retirer le tout
// dernier compte admin).
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

    if (role === 'CITIZEN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (target?.role === 'ADMIN' && adminCount <= 1) {
        const error = new Error('Impossible de rétrograder le dernier compte administrateur');
        error.status = 400;
        error.code = 'LAST_ADMIN';
        throw error;
      }
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
