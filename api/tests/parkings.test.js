// ══════════════════════════════════════════════════════════
// Tests — parkings gérés par l'administration (S5R2-05)
//
// La carte publique ne montre que les parkings PLACÉS ; l'équipe voit
// tout ; seul un ADMIN modifie (un parking n'est pas un brouillon, le
// rôle Admin-test le consulte sans le modifier).
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeEditorUser, makeCitizen } from './helpers.js';
import { INITIAL_PARKINGS, seedInitialParkings } from '../prisma/data/parkings-initiaux.js';

const API = '/api/v1/parkings';
const as = (token) => ({ Authorization: `Bearer ${token}` });
// GeoJSON : [longitude, latitude]
const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const collection = (...geometries) => ({ type: 'GeometryCollection', geometries });
const PLACE = { geometry: collection(point(2.5866, 49.2069)) }; // près de la cathédrale
// Recette du 20/10 : le stade a plusieurs aires ; la zone rouge, des places le long des rues
const STADE = collection(point(2.5781, 49.2098), point(2.5795, 49.2104));
const RUE = { type: 'LineString', coordinates: [[2.5862, 49.2061], [2.5871, 49.2058], [2.5880, 49.2054]] };

describe('Parkings — lecture', () => {
  it('le public ne voit que les parkings placés sur la carte, par ordre alphabétique', async () => {
    await prisma.parking.createMany({
      data: [
        { name: 'Parking Saint-Rieul', places: 98, regime: 'GRATUIT', ...PLACE },
        { name: 'Parking des Arènes', places: 37, regime: 'GRATUIT', geometry: collection(point(2.58, 49.205)) },
        { name: 'Parking pas encore placé', places: 10 },
      ],
    });
    const res = await request(app).get(API);
    expect(res.status).toBe(200);
    expect(res.body.items.map((p) => p.name)).toEqual(['Parking des Arènes', 'Parking Saint-Rieul']);
    expect(res.body.items[0]).not.toHaveProperty('createdAt'); // pas de dates internes
  });

  it('l’équipe (Admin-test compris) voit tout, placé ou non ; un citoyen, non', async () => {
    await prisma.parking.createMany({ data: [{ name: 'Placé', ...PLACE }, { name: 'Pas placé' }] });
    const editor = await makeEditorUser();
    const res = await request(app).get(`${API}/admin`).set(as(editor.token));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);

    const citizen = await makeCitizen();
    expect((await request(app).get(`${API}/admin`).set(as(citizen.token))).status).toBe(403);
  });
});

describe('Parkings — écriture (ADMIN)', () => {
  it('ajoute un parking avec son seul nom, puis le complète et le place ; tout est journalisé', async () => {
    const admin = await makeAdminUser();
    const created = await request(app).post(API).set(as(admin.token)).send({ name: '  Parking de la Poste  ' });
    expect(created.status).toBe(201);
    expect(created.body.parking).toMatchObject({ name: 'Parking de la Poste', charging: 'AUCUNE', geometry: null });

    const id = created.body.parking.id;
    const updated = await request(app).patch(`${API}/${id}`).set(as(admin.token)).send({
      places: 17, regime: 'ZONE_VERTE', charging: 'EN_PROJET', chargingPoints: 2, pmrPlaces: 1, note: 'Près de la poste', ...PLACE,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.parking).toMatchObject({ places: 17, regime: 'ZONE_VERTE', chargingPoints: 2, ...PLACE });

    const logs = await prisma.adminAuditLog.findMany({ where: { targetId: id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['PARKING_CREATED', 'PARKING_UPDATED']);
    expect(logs[1].details).toMatchObject({ name: 'Parking de la Poste', locations: 1 });
  });

  it('plusieurs emplacements ET des traits le long des rues (recette du 20/10)', async () => {
    const admin = await makeAdminUser();
    const res = await request(app).post(API).set(as(admin.token)).send({
      name: 'Parking du Stade', places: 92, regime: 'GRATUIT', geometry: collection(...STADE.geometries, RUE),
    });
    expect(res.status).toBe(201);
    expect(res.body.parking.geometry.geometries.map((g) => g.type)).toEqual(['Point', 'Point', 'LineString']);
    const pub = await request(app).get(API);
    expect(pub.body.items[0].geometry.geometries).toHaveLength(3);
  });

  it('retirer de la carte : geometry null (ou collection vide) ; le parking disparaît de la carte publique', async () => {
    const admin = await makeAdminUser();
    const parking = await prisma.parking.create({ data: { name: 'Parking du Heaume', ...PLACE } });
    const res = await request(app).patch(`${API}/${parking.id}`).set(as(admin.token)).send({ geometry: collection() });
    expect(res.status).toBe(200);
    expect(res.body.parking.geometry).toBeNull();
    expect((await request(app).get(API)).body.items).toHaveLength(0);

    await request(app).patch(`${API}/${parking.id}`).set(as(admin.token)).send(PLACE);
    expect((await request(app).patch(`${API}/${parking.id}`).set(as(admin.token)).send({ geometry: null })).body.parking.geometry).toBeNull();
  });

  it('« aucune » recharge efface le nombre de points de recharge', async () => {
    const admin = await makeAdminUser();
    const parking = await prisma.parking.create({ data: { name: 'Parking d’Ordener', charging: 'EXISTANTE', chargingPoints: 4 } });
    const res = await request(app).patch(`${API}/${parking.id}`).set(as(admin.token)).send({ charging: 'AUCUNE' });
    expect(res.body.parking.chargingPoints).toBeNull();
  });

  it('supprime un parking (journalisé)', async () => {
    const admin = await makeAdminUser();
    const parking = await prisma.parking.create({ data: { name: 'À supprimer' } });
    expect((await request(app).delete(`${API}/${parking.id}`).set(as(admin.token))).status).toBe(204);
    expect(await prisma.parking.count()).toBe(0);
    expect(await prisma.adminAuditLog.count({ where: { action: 'PARKING_DELETED' } })).toBe(1);
  });

  it('un compte Admin-test ne modifie pas les parkings (403)', async () => {
    const editor = await makeEditorUser();
    const parking = await prisma.parking.create({ data: { name: 'Parking du Stade' } });
    expect((await request(app).post(API).set(as(editor.token)).send({ name: 'Nouveau' })).status).toBe(403);
    expect((await request(app).patch(`${API}/${parking.id}`).set(as(editor.token)).send({ places: 1 })).status).toBe(403);
    expect((await request(app).delete(`${API}/${parking.id}`).set(as(editor.token))).status).toBe(403);
  });

  it('404 sur un parking inconnu', async () => {
    const admin = await makeAdminUser();
    expect((await request(app).patch(`${API}/inconnu`).set(as(admin.token)).send({ places: 1 })).status).toBe(404);
  });
});

describe('Parkings — validation', () => {
  it('refuse un point hors de Senlis (latitude et longitude inversées, le plus souvent)', async () => {
    const admin = await makeAdminUser();
    const res = await request(app).post(API).set(as(admin.token)).send({ name: 'Inversé', geometry: collection(point(49.2069, 2.5866)) });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error)).toMatch(/inversées/);
  });

  it('refuse un trait d’un seul point et une forme inconnue', async () => {
    const admin = await makeAdminUser();
    const oneVertex = { type: 'LineString', coordinates: [[2.5862, 49.2061]] };
    const polygon = { type: 'Polygon', coordinates: [[[2.58, 49.2], [2.59, 49.2], [2.59, 49.21], [2.58, 49.2]]] };
    expect((await request(app).post(API).set(as(admin.token)).send({ name: 'Trait court', geometry: collection(oneVertex) })).status).toBe(400);
    expect((await request(app).post(API).set(as(admin.token)).send({ name: 'Polygone', geometry: collection(polygon) })).status).toBe(400);
  });

  it('refuse un nombre de places négatif, un régime inconnu, un nom déjà pris', async () => {
    const admin = await makeAdminUser();
    expect((await request(app).post(API).set(as(admin.token)).send({ name: 'Négatif', places: -3 })).status).toBe(400);
    expect((await request(app).post(API).set(as(admin.token)).send({ name: 'Inconnu', regime: 'ZONE_BLEUE' })).status).toBe(400);

    await request(app).post(API).set(as(admin.token)).send({ name: 'Parking Saint-Pierre' });
    const twin = await request(app).post(API).set(as(admin.token)).send({ name: 'Parking Saint-Pierre' });
    expect(twin.status).toBe(409);
    expect(twin.body.error.code).toBe('PARKING_NAME_TAKEN');
  });
});

describe('Parkings — données initiales (plan 2023 + guide 2025)', () => {
  it('insérées seulement dans une table vide ; noms uniques ; régimes valides', async () => {
    expect(new Set(INITIAL_PARKINGS.map((p) => p.name)).size).toBe(INITIAL_PARKINGS.length);
    expect(await seedInitialParkings(prisma)).toBe(INITIAL_PARKINGS.length);
    expect(await seedInitialParkings(prisma)).toBe(0); // rien de plus au 2e lancement
    expect(await prisma.parking.count()).toBe(INITIAL_PARKINGS.length);
    // Aucun n'est placé : c'est le travail de l'écran d'administration
    expect((await prisma.parking.findMany()).every((p) => p.geometry === null)).toBe(true);
  });
});
