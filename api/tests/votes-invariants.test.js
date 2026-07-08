// ══════════════════════════════════════════════════════════
// Tests d'intégration — Invariants du vote (Sprint 2, S2-06)
//
// Ce fichier a un objectif différent de proposals.test.js : il
// ne teste pas "est-ce que la fonctionnalité marche", mais
// "est-ce que les RÈGLES qui ne doivent JAMAIS être violées
// tiennent, même dans les pires conditions" — directement
// adossé au use case UC-02 (04-use-cases.md).
//
// Analogie : proposals.test.js vérifie que la porte s'ouvre et
// se ferme normalement. Ce fichier-ci vérifie qu'elle ne casse
// pas si deux personnes la poussent EXACTEMENT en même temps —
// le genre de situation qu'un test manuel ne recrée presque
// jamais par hasard, mais qu'une vraie utilisation (double clic,
// deux onglets ouverts) provoque tôt ou tard.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeCitizen, seedProposal } from './helpers.js';

const API = '/api/v1/proposals';

describe('Invariants du vote — UC-02', () => {
  // ── Invariant : unicité, même sous concurrence réelle (4a) ──
  it(
    "deux votes envoyés EN MÊME TEMPS par le même citoyen n'en produisent qu'un seul en base",
    async () => {
      const proposal = await seedProposal();
      const { token } = await makeCitizen();

      // Promise.all envoie les deux requêtes EN PARALLÈLE, pas l'une
      // après l'autre — c'est la différence avec le test "change d'avis"
      // de proposals.test.js, qui vote séquentiellement. Ici, on simule
      // un vrai double clic ou deux onglets ouverts sur la même page.
      const [resA, resB] = await Promise.all([
        request(app).put(`${API}/${proposal.id}/vote`).set('Authorization', `Bearer ${token}`).send({ value: 'POUR' }),
        request(app).put(`${API}/${proposal.id}/vote`).set('Authorization', `Bearer ${token}`).send({ value: 'POUR' }),
      ]);

      // Aucune des deux requêtes ne doit planter (pas de 500) — la
      // contrainte UNIQUE(userId, proposalId) doit absorber le
      // conflit proprement, jamais le remonter comme une erreur serveur.
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // La vraie preuve n'est pas dans la réponse HTTP, mais dans
      // ce qui reste RÉELLEMENT en base : une seule ligne, jamais deux.
      const votesInDb = await prisma.vote.findMany({ where: { proposalId: proposal.id } });
      expect(votesInDb).toHaveLength(1);
    },
    10000 // deux vraies requêtes HTTP + Argon2 en parallèle : un peu plus lent que la moyenne
  );

  // ── Invariant : la contrainte existe en BASE, pas seulement dans le code JS (4a) ──
  //
  // Ce test-ci ne passe même pas par l'API : il essaie de créer deux
  // Vote directement via Prisma, pour prouver que même un bug futur
  // dans castVote() (un if oublié, une regression) ne pourrait
  // JAMAIS produire deux votes pour le même citoyen sur la même
  // proposition — PostgreSQL refuserait la deuxième ligne, quoi
  // qu'il arrive côté application.
  //
  // Analogie : comme le dit 05-diagramme-sequence.md pour les
  // enquêtes, "le conflit n'est pas un bug, c'est la contrainte qui
  // travaille" — la même philosophie s'applique ici au vote.
  it('la contrainte @@unique([userId, proposalId]) refuse un doublon au niveau base de données', async () => {
    const proposal = await seedProposal();
    const { user } = await makeCitizen();

    await prisma.vote.create({ data: { userId: user.id, proposalId: proposal.id, value: 'POUR' } });

    // La deuxième création DOIT échouer — c'est ce qu'on teste.
    await expect(
      prisma.vote.create({ data: { userId: user.id, proposalId: proposal.id, value: 'CONTRE' } })
    ).rejects.toThrow();

    const votesInDb = await prisma.vote.findMany({ where: { proposalId: proposal.id } });
    expect(votesInDb).toHaveLength(1);
  });

  // ── Invariant : non connecté (2a) ───────────────────────
  it('401 sans authentification — jamais de vote anonyme, quelle que soit la proposition', async () => {
    const proposal = await seedProposal();
    const res = await request(app).put(`${API}/${proposal.id}/vote`).send({ value: 'POUR' });
    expect(res.status).toBe(401);
  });

  // ── Invariant : email non vérifié (2b) ──────────────────
  it("403 EMAIL_NOT_VERIFIED — un compte non vérifié ne peut jamais peser dans les résultats", async () => {
    const proposal = await seedProposal();
    const credentials = { email: 'non-verifie@senlis-test.fr', password: 'MotDePasse123!', pseudo: 'nonverifie' };
    await request(app).post('/api/v1/auth/register').send(credentials);
    // Pas de vérification d'email ici — volontairement.

    // Le compte n'étant pas vérifié, il ne peut même pas se connecter
    // (voir auth.test.js) — donc il ne peut structurellement jamais
    // obtenir de JWT pour tenter de voter. On le confirme ici :
    const login = await request(app).post('/api/v1/auth/login').send({ email: credentials.email, password: credentials.password });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  // ── Invariant : proposition CLOSED (3a) ─────────────────
  it('403 VOTES_CLOSED — une proposition clôturée ne peut plus recevoir de vote, admin compris', async () => {
    const closed = await seedProposal({ status: 'CLOSED' });
    const { token } = await makeCitizen();

    const res = await request(app)
      .put(`${API}/${closed.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'POUR' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('VOTES_CLOSED');

    // Confirme qu'aucune ligne n'a été écrite malgré le refus —
    // un 403 qui laisserait quand même une trace en base serait
    // pire qu'inutile, ce serait trompeur.
    const votesInDb = await prisma.vote.findMany({ where: { proposalId: closed.id } });
    expect(votesInDb).toHaveLength(0);
  });
});
