// ══════════════════════════════════════════════════════════
// Tests d'intégration — Gestion des comptes (S5-19)
//
// Volontairement minimal (comme la fonctionnalité elle-même) :
// lister/rechercher, promouvoir, rétrograder, et les deux
// garde-fous de sécurité (jamais se bloquer soi-même hors du site).
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { makeAdminUser, makeCitizen } from './helpers.js';

const API = '/api/v1/admin/users';

describe('Gestion des comptes — liste', () => {
  it('refuse sans authentification', async () => {
    const res = await request(app).get(API);
    expect(res.status).toBe(401);
  });

  it('refuse à un citoyen non-admin', async () => {
    const { token } = await makeCitizen();
    const res = await request(app).get(API).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('un admin voit la liste, avec pagination', async () => {
    const { token } = await makeAdminUser();
    await makeCitizen();
    await makeCitizen();

    const res = await request(app).get(API).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    // Au moins l'admin lui-même + les 2 citoyens tout juste créés.
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it('filtre par recherche (email ou pseudo)', async () => {
    const { token } = await makeAdminUser();
    const { user: citizen } = await makeCitizen();

    const res = await request(app)
      .get(`${API}?search=${encodeURIComponent(citizen.pseudo)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.some((u) => u.id === citizen.id)).toBe(true);
    // La recherche doit vraiment FILTRER, pas juste être ignorée —
    // un admin dont le pseudo ne contient pas cette chaîne ne doit
    // pas apparaître dans les résultats.
    expect(res.body.items.every((u) => u.pseudo.toLowerCase().includes(citizen.pseudo.toLowerCase())
      || u.email.toLowerCase().includes(citizen.pseudo.toLowerCase()))).toBe(true);
  });
});

describe('Gestion des comptes — changement de rôle', () => {
  it('refuse sans authentification', async () => {
    const res = await request(app).patch(`${API}/some-id`).send({ role: 'ADMIN' });
    expect(res.status).toBe(401);
  });

  it('refuse à un citoyen non-admin', async () => {
    const { token, user } = await makeCitizen();
    const res = await request(app)
      .patch(`${API}/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('promeut un citoyen en administrateur', async () => {
    const { token: adminToken } = await makeAdminUser();
    const { user: citizen } = await makeCitizen();

    const res = await request(app)
      .patch(`${API}/${citizen.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('rétrograde un admin en citoyen (si ce n\'est pas soi-même)', async () => {
    const { token: adminToken } = await makeAdminUser();
    const { user: secondAdmin } = await makeAdminUser();

    const res = await request(app)
      .patch(`${API}/${secondAdmin.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'CITIZEN' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('CITIZEN');
  });

  it('400 CANNOT_DEMOTE_SELF — impossible de se rétrograder soi-même', async () => {
    const { token, user } = await makeAdminUser();

    const res = await request(app)
      .patch(`${API}/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'CITIZEN' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_DEMOTE_SELF');
  });

  // Pas de test pour un "dernier admin" séparé : ce garde-fou a été
  // retiré du contrôleur car structurellement inatteignable — voir
  // le commentaire dans usersController.js. CANNOT_DEMOTE_SELF
  // garantit déjà, à lui seul, qu'il reste toujours au moins un
  // admin (voir le test juste au-dessus).

  it('404 en changeant le rôle d\'un compte inexistant', async () => {
    const { token } = await makeAdminUser();

    const res = await request(app)
      .patch(`${API}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(404);
  });

  it('rejette un rôle invalide (validation Zod)', async () => {
    const { token } = await makeAdminUser();
    const { user: citizen } = await makeCitizen();

    const res = await request(app)
      .patch(`${API}/${citizen.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'SUPER_ADMIN' });

    expect(res.status).toBe(400);
  });
});
