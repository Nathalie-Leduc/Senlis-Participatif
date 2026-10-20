// ══════════════════════════════════════════════════════════
// Contrôleur — parkings gérés par l'administration (S5R2-05)
//
//   GET    /parkings          public : les parkings PLACÉS sur la carte
//   GET    /parkings/admin    équipe : tous, placés ou non
//   POST   /parkings          ADMIN : ajouter
//   PATCH  /parkings/:id      ADMIN : modifier, placer ou retirer de la carte
//   DELETE /parkings/:id      ADMIN : supprimer
//
// Chaque modification est notée au journal d'administration.
// ══════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';
import { logAdminAction, AUDIT_ACTIONS } from '../services/audit.js';

// Ce que voit le public : pas de dates internes
const PUBLIC_SELECT = {
  id: true, name: true, places: true, regime: true, charging: true,
  chargingPoints: true, pmrPlaces: true, note: true, lat: true, lng: true,
};

function notFound() {
  const error = new Error('Parking introuvable');
  error.status = 404;
  error.code = 'NOT_FOUND';
  return error;
}

// Ordre alphabétique « à la française » (accents, majuscules) : le tri
// de PostgreSQL dépend de la langue configurée sur le serveur — en
// « C », « Parking Saint-Rieul » passait avant « Parking des Arènes ».
const collator = new Intl.Collator('fr', { sensitivity: 'base' });
const byName = (a, b) => collator.compare(a.name, b.name);

/** Les champs envoyés, rendus cohérents avant l'écriture */
function toData(body) {
  const data = { ...body };
  // « Aucune » recharge : plus de nombre de points de recharge
  if (data.charging === 'AUCUNE') data.chargingPoints = null;
  return data;
}

// ── GET /parkings — public ─────────────────────────────────
export async function list(req, res, next) {
  try {
    const items = await prisma.parking.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      select: PUBLIC_SELECT,
    });
    res.json({ items: items.sort(byName) });
  } catch (err) {
    next(err);
  }
}

// ── GET /parkings/admin — équipe (admin, Admin-test) ──────
export async function listAdmin(req, res, next) {
  try {
    const items = await prisma.parking.findMany();
    res.json({ items: items.sort(byName) });
  } catch (err) {
    next(err);
  }
}

// ── POST /parkings — ADMIN ────────────────────────────────
export async function create(req, res, next) {
  try {
    const parking = await prisma.parking.create({ data: toData(req.body) });
    await logAdminAction({
      actorId: req.user.userId,
      action: AUDIT_ACTIONS.PARKING_CREATED,
      targetType: 'Parking',
      targetId: parking.id,
      details: { name: parking.name },
    });
    res.status(201).json({ parking });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /parkings/:id — ADMIN ───────────────────────────
export async function update(req, res, next) {
  try {
    const existing = await prisma.parking.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound();

    const parking = await prisma.parking.update({ where: { id: existing.id }, data: toData(req.body) });
    await logAdminAction({
      actorId: req.user.userId,
      action: AUDIT_ACTIONS.PARKING_UPDATED,
      targetType: 'Parking',
      targetId: parking.id,
      // Les champs modifiés ; « placé / retiré de la carte » en clair
      details: {
        name: parking.name,
        fields: Object.keys(req.body),
        ...('lat' in req.body && { placed: req.body.lat !== null }),
      },
    });
    res.json({ parking });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /parkings/:id — ADMIN ──────────────────────────
export async function remove(req, res, next) {
  try {
    const existing = await prisma.parking.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound();

    await prisma.parking.delete({ where: { id: existing.id } });
    await logAdminAction({
      actorId: req.user.userId,
      action: AUDIT_ACTIONS.PARKING_DELETED,
      targetType: 'Parking',
      targetId: existing.id,
      details: { name: existing.name },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
