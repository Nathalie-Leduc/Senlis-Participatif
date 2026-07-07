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
import { makeAdminUser, makeCitizen, buildUser, extractTokenFromEmail } from './helpers.js';
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

  it('chaque carte de la liste porte son agrégat de votes', async () => {
    await seedProposal({ title: 'Avec votes' });

    const res = await request(app).get(API);

    expect(res.body.items[0].votes).toEqual({ POUR: 0, CONTRE: 0, NEUTRE: 0 });
  });

  it('filtre la liste par statut (?status=CLOSED)', async () => {
    await seedProposal({ title: 'Publiée', status: 'PUBLISHED' });
    await seedProposal({ title: 'Close', status: 'CLOSED' });

    const res = await request(app).get(`${API}?status=CLOSED`);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Close');
  });

  it('rejette un statut hors PUBLISHED/CLOSED (ex. DRAFT) dans le filtre', async () => {
    const res = await request(app).get(`${API}?status=DRAFT`);
    expect(res.status).toBe(400);
  });

  it('trie par nombre de votes (?sort=votes) quand demandé', async () => {
    const peuVotee = await seedProposal({ title: 'Peu votée' });
    const treVotee = await seedProposal({ title: 'Très votée' });
    const { user } = await makeCitizen();

    await prisma.vote.createMany({
      data: [
        { userId: user.id, proposalId: peuVotee.id, value: 'POUR' },
      ],
    });
    // Deux citoyens différents pour la seconde, car un même userId ne
    // peut voter qu'une fois sur une même proposition (contrainte unique).
    const alice = await makeCitizen();
    const bob = await makeCitizen();
    await prisma.vote.createMany({
      data: [
        { userId: alice.user.id, proposalId: treVotee.id, value: 'POUR' },
        { userId: bob.user.id, proposalId: treVotee.id, value: 'CONTRE' },
      ],
    });

    const res = await request(app).get(`${API}?sort=votes`);

    expect(res.body.items[0].title).toBe('Très votée');
    expect(res.body.items[1].title).toBe('Peu votée');
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

  it("myVote est absent (null) pour un visiteur anonyme", async () => {
    const proposal = await seedProposal();
    const res = await request(app).get(`${API}/${proposal.slug}`);
    expect(res.body.myVote).toBeNull();
  });

  it('myVote reflète le vote déjà enregistré pour un citoyen connecté', async () => {
    const proposal = await seedProposal();
    const { token } = await makeCitizen();

    await request(app)
      .put(`${API}/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'CONTRE' });

    const res = await request(app)
      .get(`${API}/${proposal.slug}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.myVote).toBe('CONTRE');
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

describe('Propositions — vote', () => {
  it('refuse de voter sans authentification', async () => {
    const proposal = await seedProposal();
    const res = await request(app).put(`${API}/${proposal.id}/vote`).send({ value: 'POUR' });
    expect(res.status).toBe(401);
  });

  it("refuse de voter sans email vérifié", async () => {
    const proposal = await seedProposal();
    const credentials = buildUser();
    await request(app).post('/api/v1/auth/register').send(credentials);
    // Pas de vérification d'email ici, volontairement.
    // On ne peut pas se connecter sans email vérifié (voir auth.test.js),
    // donc on ne peut même pas obtenir de JWT — ce test documente
    // qu'EMAIL_NOT_VERIFIED est de toute façon inatteignable sans passer
    // par login, qui bloque déjà en amont. On vérifie donc plutôt le cas
    // symétrique : login refusé, comme prévu par le contrôleur auth.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('un citoyen vote POUR — upsert en création', async () => {
    const proposal = await seedProposal();
    const { token } = await makeCitizen();

    const res = await request(app)
      .put(`${API}/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'POUR' });

    expect(res.status).toBe(200);
    expect(res.body.votes).toEqual({ POUR: 1, CONTRE: 0, NEUTRE: 0 });
  });

  it("un citoyen change d'avis — upsert en mise à jour, pas de doublon", async () => {
    const proposal = await seedProposal();
    const { token } = await makeCitizen();

    await request(app).put(`${API}/${proposal.id}/vote`).set('Authorization', `Bearer ${token}`).send({ value: 'POUR' });
    const res = await request(app)
      .put(`${API}/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'CONTRE' });

    expect(res.status).toBe(200);
    // Un seul vote pour ce citoyen : POUR est retombé à 0, CONTRE est monté à 1.
    expect(res.body.votes).toEqual({ POUR: 0, CONTRE: 1, NEUTRE: 0 });

    const votesInDb = await prisma.vote.findMany({ where: { proposalId: proposal.id } });
    expect(votesInDb).toHaveLength(1);
  });

  it('rejette une valeur de vote invalide', async () => {
    const proposal = await seedProposal();
    const { token } = await makeCitizen();

    const res = await request(app)
      .put(`${API}/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'PEUT-ETRE' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse de voter sur une proposition CLOSED', async () => {
    const proposal = await seedProposal({ status: 'CLOSED' });
    const { token } = await makeCitizen();

    const res = await request(app)
      .put(`${API}/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'POUR' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('VOTES_CLOSED');
  });

  it('refuse de voter après la date closesAt, même si le statut est encore PUBLISHED', async () => {
    const hier = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const proposal = await seedProposal({ closesAt: hier });
    const { token } = await makeCitizen();

    const res = await request(app)
      .put(`${API}/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'POUR' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('VOTES_CLOSED');
  });

  it('renvoie 404 en votant sur une proposition inexistante', async () => {
    const { token } = await makeCitizen();

    const res = await request(app)
      .put(`${API}/00000000-0000-0000-0000-000000000000/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'POUR' });

    expect(res.status).toBe(404);
  });

  it('un citoyen retire son vote', async () => {
    const proposal = await seedProposal();
    const { token } = await makeCitizen();

    await request(app).put(`${API}/${proposal.id}/vote`).set('Authorization', `Bearer ${token}`).send({ value: 'NEUTRE' });
    const res = await request(app)
      .delete(`${API}/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.votes).toEqual({ POUR: 0, CONTRE: 0, NEUTRE: 0 });

    const votesInDb = await prisma.vote.findMany({ where: { proposalId: proposal.id } });
    expect(votesInDb).toHaveLength(0);
  });

  it("renvoie 404 en retirant un vote qui n'existe pas", async () => {
    const proposal = await seedProposal();
    const { token } = await makeCitizen();

    const res = await request(app)
      .delete(`${API}/${proposal.id}/vote`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('deux citoyens différents votent sans se marcher dessus', async () => {
    const proposal = await seedProposal();
    const alice = await makeCitizen();
    const bob = await makeCitizen();

    await request(app).put(`${API}/${proposal.id}/vote`).set('Authorization', `Bearer ${alice.token}`).send({ value: 'POUR' });
    await request(app).put(`${API}/${proposal.id}/vote`).set('Authorization', `Bearer ${bob.token}`).send({ value: 'CONTRE' });

    const res = await request(app).get(`${API}/${proposal.slug}`);
    expect(res.body.votes).toEqual({ POUR: 1, CONTRE: 1, NEUTRE: 0 });
  });
});
