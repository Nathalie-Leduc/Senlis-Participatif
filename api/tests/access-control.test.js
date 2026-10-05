// ══════════════════════════════════════════════════════════
// Tests d'intégration — Contrôle d'accès (S5A-01)
//
// Faille corrigée : le rôle était lu DANS le JWT (valable 7h). Un
// admin rétrogradé, ou un compte supprimé, gardait donc ses droits
// jusqu'à l'expiration de son jeton — OWASP A01.
//
// Principe de ces tests : on garde le MÊME jeton (signature parfaite,
// pas expiré), on change la réalité en base, et on vérifie que
// l'API suit la base et non le jeton.
//
// Analogie : on retire le badge dans le registre du personnel, puis
// on vérifie que la porte refuse le badge… sans avoir besoin de le
// confisquer physiquement.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeCitizen, makeAdminUser, seedProposal } from './helpers.js';

const ADMIN_ONLY_ROUTE = '/api/v1/proposals/admin';

describe('Rôle relu en base à chaque requête', () => {
  it("un admin rétrogradé perd ses droits IMMÉDIATEMENT, avec son jeton toujours valide", async () => {
    const { user, token } = await makeAdminUser();

    // Avant : le jeton ouvre bien la route admin
    const before = await request(app).get(ADMIN_ONLY_ROUTE).set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    // Rétrogradation en base — le jeton, lui, dit toujours "ADMIN"
    await prisma.user.update({ where: { id: user.id }, data: { role: 'CITIZEN' } });
    expect(jwt.decode(token).role).toBe('ADMIN');

    const after = await request(app).get(ADMIN_ONLY_ROUTE).set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe('FORBIDDEN');
  });

  it('même chose de bout en bout : un admin en rétrograde un autre via PATCH /admin/users/:id', async () => {
    const alice = await makeAdminUser();
    const bob = await makeAdminUser();

    const demote = await request(app)
      .patch(`/api/v1/admin/users/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ role: 'CITIZEN' });
    expect(demote.status).toBe(200);

    // Bob n'a pas été déconnecté : son jeton est intact… mais inutile
    const res = await request(app)
      .patch(`/api/v1/admin/users/${alice.user.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ role: 'CITIZEN' });
    expect(res.status).toBe(403);

    // …et il n'a donc pas pu rétrograder Alice en retour
    const aliceInDb = await prisma.user.findUnique({ where: { id: alice.user.id } });
    expect(aliceInDb.role).toBe('ADMIN');
  });

  it("symétrique : un citoyen promu admin accède aux routes admin sans se reconnecter", async () => {
    const { user, token } = await makeCitizen();
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

    const res = await request(app).get(ADMIN_ONLY_ROUTE).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("GET /auth/me renvoie le rôle ACTUEL, pas celui du jeton", async () => {
    const { user, token } = await makeAdminUser();
    await prisma.user.update({ where: { id: user.id }, data: { role: 'CITIZEN' } });

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('CITIZEN');
  });
});

describe('Routes publiques avec optionalAuth', () => {
  it("un admin rétrogradé ne voit plus les brouillons via GET /proposals/:slug", async () => {
    const draft = await seedProposal({ status: 'DRAFT', publishedAt: null });
    const { user, token } = await makeAdminUser();

    const before = await request(app).get(`/api/v1/proposals/${draft.slug}`).set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    await prisma.user.update({ where: { id: user.id }, data: { role: 'CITIZEN' } });

    const after = await request(app).get(`/api/v1/proposals/${draft.slug}`).set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(404);
  });

  it("le jeton d'un compte supprimé est traité comme un visiteur anonyme (pas d'erreur)", async () => {
    const proposal = await seedProposal();
    const { user, token } = await makeCitizen();
    await prisma.user.delete({ where: { id: user.id } });

    const res = await request(app).get(`/api/v1/proposals/${proposal.slug}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.myVote ?? null).toBeNull();
  });
});

describe('Compte supprimé', () => {
  it('401 sur une route protégée avec le jeton d\'un compte supprimé', async () => {
    const { user, token } = await makeCitizen();
    await prisma.user.delete({ where: { id: user.id } });

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it("un compte supprimé ne peut plus voter (401, pas une 500 de clé étrangère)", async () => {
    const proposal = await seedProposal();
    const { user, token } = await makeCitizen();
    await prisma.user.delete({ where: { id: user.id } });

    const res = await request(app)
      .put(`/api/v1/proposals/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'POUR' });
    expect(res.status).toBe(401);
  });
});

describe('Algorithme JWT épinglé (HS256)', () => {
  it("refuse un jeton non signé (alg: none)", async () => {
    const { user } = await makeCitizen();
    const unsigned = jwt.sign({ userId: user.id, role: 'ADMIN' }, null, { algorithm: 'none' });

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${unsigned}`);
    expect(res.status).toBe(401);
  });

  it('refuse un jeton signé avec le BON secret mais un autre algorithme (HS512)', async () => {
    const { user } = await makeCitizen();
    const otherAlg = jwt.sign({ userId: user.id, role: 'CITIZEN' }, process.env.JWT_SECRET, { algorithm: 'HS512' });

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${otherAlg}`);
    expect(res.status).toBe(401);
  });

  it('les jetons émis par le serveur sont bien en HS256', async () => {
    const { token } = await makeCitizen();
    expect(jwt.decode(token, { complete: true }).header.alg).toBe('HS256');
  });
});
