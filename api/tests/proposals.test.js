// ══════════════════════════════════════════════════════════
// Tests d'intégration — Propositions (Sprint 2, partie 1)
//
// Deux angles à couvrir : ce que voit le PUBLIC (jamais un
// brouillon) et ce que peut faire un ADMIN (tout, via JWT +
// rôle ADMIN). On ne teste pas encore le vote — il arrive dans
// la prochaine partie du Sprint 2.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, buildUser, extractTokenFromEmail } from './helpers.js';
import { sendMailMock } from './setup.js';

const API = '/api/v1/proposals';

// Raccourci : crée une proposition directement en base (sans passer
// par l'API), pour préparer le terrain d'un test sans dépendre du
// contrôleur qu'on est justement en train de tester.
function seedProposal(overrides = {}) {
  return prisma.proposal.create({
    data: {
      slug: `proposition-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Piétonnisation du centre historique',
      summary: 'Fermer le centre-ville à la circulation chaque samedi.',
      content: 'Argumentaire complet avec chiffres INSEE et retours des commerçants...',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      ...overrides,
    },
  });
}

describe('Propositions — liste et détail publics', () => {
  it('liste uniquement les propositions PUBLISHED et CLOSED', async () => {
    await seedProposal({ title: 'Publiée', status: 'PUBLISHED', publishedAt: new Date() });
    await seedProposal({ title: 'Close', status: 'CLOSED', publishedAt: new Date() });
    await seedProposal({ title: 'Brouillon', status: 'DRAFT', publishedAt: null });
    await seedProposal({ title: 'En attente', status: 'PENDING_REVIEW', publishedAt: null });

    const res = await request(app).get(API);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((p) => p.title).sort()).toEqual(['Close', 'Publiée']);
  });

  it('pagine correctement (page, limit, total, totalPages)', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await seedProposal({ title: `Proposition ${i}` });
    }

    const res = await request(app).get(`${API}?page=2&limit=2`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('rejette des paramètres de pagination invalides', async () => {
    const res = await request(app).get(`${API}?page=0`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('renvoie le détail avec l\'agrégat des votes (0 partout si personne n\'a voté)', async () => {
    const proposal = await seedProposal();

    const res = await request(app).get(`${API}/${proposal.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.proposal.title).toBe(proposal.title);
    expect(res.body.votes).toEqual({ POUR: 0, CONTRE: 0, NEUTRE: 0 });
  });

  it('agrège correctement des votes existants par valeur', async () => {
    const proposal = await seedProposal();

    // Séquentiel, PAS Promise.all : chaque inscription doit être
    // complètement terminée (email lu, vérifié, connecté) avant de
    // commencer la suivante — sinon plusieurs inscriptions en vol
    // en même temps se disputent le "dernier email envoyé" du mock.
    const voters = [];
    for (const u of [buildUser(), buildUser(), buildUser()]) {
      await request(app).post('/api/v1/auth/register').send(u);
      const token = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
      await request(app).post('/api/v1/auth/verify-email').send({ token });
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: u.email, password: u.password });
      voters.push(login.body.user.id);
    }

    await prisma.vote.createMany({
      data: [
        { userId: voters[0], proposalId: proposal.id, value: 'POUR' },
        { userId: voters[1], proposalId: proposal.id, value: 'POUR' },
        { userId: voters[2], proposalId: proposal.id, value: 'CONTRE' },
      ],
    });

    const res = await request(app).get(`${API}/${proposal.slug}`);

    expect(res.body.votes).toEqual({ POUR: 2, CONTRE: 1, NEUTRE: 0 });
  });

  it('renvoie 404 (pas 403) pour une proposition en brouillon — sans révéler qu\'elle existe', async () => {
    const draft = await seedProposal({ status: 'DRAFT', publishedAt: null });

    const res = await request(app).get(`${API}/${draft.slug}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('renvoie 404 pour un slug inexistant', async () => {
    const res = await request(app).get(`${API}/ce-slug-n-existe-pas`);
    expect(res.status).toBe(404);
  });
});

describe('Propositions — CRUD admin', () => {
  it('refuse la création sans authentification', async () => {
    const res = await request(app).post(API).send({
      title: 'Nouvelle proposition',
      summary: 'Une accroche suffisamment longue pour passer la validation.',
      content: 'Un argumentaire suffisamment long pour passer la validation Zod.',
    });

    expect(res.status).toBe(401);
  });

  it('refuse la création à un citoyen non-admin', async () => {
    const citoyen = buildUser();
    await request(app).post('/api/v1/auth/register').send(citoyen);
    const token = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
    await request(app).post('/api/v1/auth/verify-email').send({ token });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: citoyen.email, password: citoyen.password });

    const res = await request(app)
      .post(API)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        title: 'Nouvelle proposition',
        summary: 'Une accroche suffisamment longue pour passer la validation.',
        content: 'Un argumentaire suffisamment long pour passer la validation Zod.',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('un admin crée une proposition, en DRAFT par défaut, avec un slug généré', async () => {
    const { token } = await makeAdminUser();

    const res = await request(app)
      .post(API)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Piétonnisation du centre historique !',
        summary: 'Une accroche suffisamment longue pour passer la validation.',
        content: 'Un argumentaire suffisamment long pour passer la validation Zod.',
      });

    expect(res.status).toBe(201);
    expect(res.body.proposal.status).toBe('DRAFT');
    expect(res.body.proposal.slug).toBe('pietonnisation-du-centre-historique');
    expect(res.body.proposal.publishedAt).toBeNull();
  });

  it('génère un slug différent pour deux propositions au même titre', async () => {
    const { token } = await makeAdminUser();
    const payload = {
      title: 'Même titre',
      summary: 'Une accroche suffisamment longue pour passer la validation.',
      content: 'Un argumentaire suffisamment long pour passer la validation Zod.',
    };

    const first = await request(app).post(API).set('Authorization', `Bearer ${token}`).send(payload);
    const second = await request(app).post(API).set('Authorization', `Bearer ${token}`).send(payload);

    expect(first.body.proposal.slug).toBe('meme-titre');
    expect(second.body.proposal.slug).toBe('meme-titre-2');
  });

  it('rejette une création avec un titre trop court (validation Zod)', async () => {
    const { token } = await makeAdminUser();

    const res = await request(app)
      .post(API)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Abc', summary: 'x'.repeat(20), content: 'x'.repeat(30) });

    expect(res.status).toBe(400);
    expect(res.body.error.details.title).toBeDefined();
  });

  it('fixe publishedAt au moment où une proposition passe PUBLISHED', async () => {
    const { token } = await makeAdminUser();
    const draft = await seedProposal({ status: 'DRAFT', publishedAt: null });

    const res = await request(app)
      .patch(`${API}/${draft.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('PUBLISHED');
    expect(res.body.proposal.publishedAt).not.toBeNull();
  });

  it('ne réécrit pas publishedAt si la proposition était déjà PUBLISHED', async () => {
    const { token } = await makeAdminUser();
    const original = await seedProposal({ status: 'PUBLISHED' });

    const res = await request(app)
      .patch(`${API}/${original.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Titre corrigé', status: 'PUBLISHED' });

    expect(new Date(res.body.proposal.publishedAt).getTime()).toBe(original.publishedAt.getTime());
  });

  it('renvoie 404 en éditant une proposition inexistante', async () => {
    const { token } = await makeAdminUser();

    const res = await request(app)
      .patch(`${API}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Peu importe' });

    expect(res.status).toBe(404);
  });

  it('un admin supprime une proposition', async () => {
    const { token } = await makeAdminUser();
    const proposal = await seedProposal();

    const res = await request(app)
      .delete(`${API}/${proposal.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    const stillThere = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    expect(stillThere).toBeNull();
  });

  it('renvoie 404 en supprimant une proposition déjà supprimée', async () => {
    const { token } = await makeAdminUser();

    const res = await request(app)
      .delete(`${API}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});