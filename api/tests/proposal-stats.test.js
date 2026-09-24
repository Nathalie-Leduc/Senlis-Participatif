// ══════════════════════════════════════════════════════════
// Tests d'intégration — Résultats détaillés d'une proposition
// (S5-21, volet propositions)
//
// GET /api/v1/proposals/:id/stats[?segmentBy=<champ du profil>]
//
// Trois familles de règles vérifiées :
//  1. l'accès (admin uniquement — la répartition des votes par profil
//     n'a rien à faire dans une vue publique) ;
//  2. l'exactitude (la somme des segments = le total) ;
//  3. la confidentialité (un groupe de 1 à 4 votants est masqué).
//
// Les votants sont créés directement en base (seedUser) : il en faut
// au moins 5 par groupe pour franchir le seuil de confidentialité.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeCitizen, makeAdminUser, seedProposal, seedUser } from './helpers.js';

const API = '/api/v1/proposals';

/**
 * Crée `count` votants avec le profil donné, qui votent tous `value`.
 * @example await seedVotes(proposal.id, 3, 'POUR', { situation: 'HORS_SENLIS' })
 */
async function seedVotes(proposalId, count, value, profile = {}) {
  for (let i = 0; i < count; i++) {
    const user = await seedUser(profile);
    await prisma.vote.create({ data: { userId: user.id, proposalId, value } });
  }
}

describe('GET /proposals/:id/stats — accès', () => {
  it('401 sans authentification', async () => {
    const proposal = await seedProposal();
    const res = await request(app).get(`${API}/${proposal.id}/stats`);
    expect(res.status).toBe(401);
  });

  it('403 pour un citoyen non-admin', async () => {
    const proposal = await seedProposal();
    const { token } = await makeCitizen();
    const res = await request(app).get(`${API}/${proposal.id}/stats`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('404 pour une proposition inexistante', async () => {
    const { token } = await makeAdminUser();
    const res = await request(app)
      .get(`${API}/00000000-0000-0000-0000-000000000000/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400 pour un critère de segmentation inconnu (ex. email — jamais un axe de segmentation)', async () => {
    const proposal = await seedProposal();
    const { token } = await makeAdminUser();
    const res = await request(app)
      .get(`${API}/${proposal.id}/stats?segmentBy=email`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /proposals/:id/stats — résultats', () => {
  it('sans segmentBy : totaux par camp seulement', async () => {
    const proposal = await seedProposal();
    const { token } = await makeAdminUser();
    await seedVotes(proposal.id, 2, 'POUR');
    await seedVotes(proposal.id, 1, 'CONTRE');

    const res = await request(app).get(`${API}/${proposal.id}/stats`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ id: proposal.id, title: proposal.title });
    expect(res.body.votes).toEqual({ POUR: 2, CONTRE: 1, NEUTRE: 0 });
    expect(res.body.totalVotes).toBe(3);
    expect(res.body.segmentedBy).toBeUndefined();
  });

  it('segmentBy=situation : un segment par valeur (+ non renseigné), somme = total', async () => {
    const proposal = await seedProposal();
    const { token } = await makeAdminUser();
    await seedVotes(proposal.id, 3, 'POUR', { situation: 'CENTRE_RESIDENT' });
    await seedVotes(proposal.id, 2, 'CONTRE', { situation: 'CENTRE_RESIDENT' });
    await seedVotes(proposal.id, 6, 'NEUTRE', { situation: 'HORS_SENLIS' });

    const res = await request(app)
      .get(`${API}/${proposal.id}/stats?segmentBy=situation`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { segmentedBy } = res.body;
    expect(segmentedBy.dimension).toBe('situation');
    expect(segmentedBy.minGroupSize).toBe(5);

    // Toutes les valeurs apparaissent, même vides — dans l'ordre de l'enum
    expect(segmentedBy.segments.map((s) => s.value))
      .toEqual(['CENTRE_RESIDENT', 'AUTRE_QUARTIER', 'HORS_SENLIS', null]);

    const byValue = Object.fromEntries(segmentedBy.segments.map((s) => [s.value, s]));
    expect(byValue.CENTRE_RESIDENT).toEqual({
      value: 'CENTRE_RESIDENT', masked: false, totalVotes: 5, votes: { POUR: 3, CONTRE: 2, NEUTRE: 0 },
    });
    expect(byValue.HORS_SENLIS.votes).toEqual({ POUR: 0, CONTRE: 0, NEUTRE: 6 });
    expect(byValue.AUTRE_QUARTIER).toMatchObject({ masked: false, totalVotes: 0 });

    const sum = segmentedBy.segments.reduce((acc, s) => acc + s.totalVotes, 0);
    expect(sum).toBe(res.body.totalVotes);
  });

  it('masque un groupe de 1 à 4 votants — ni effectif, ni répartition', async () => {
    const proposal = await seedProposal();
    const { token } = await makeAdminUser();
    await seedVotes(proposal.id, 5, 'POUR', { situation: 'CENTRE_RESIDENT' });
    // Deux salariés de la Zone industrielle : reconnaissables → masqués
    await seedVotes(proposal.id, 2, 'CONTRE', {
      situation: 'HORS_SENLIS', travailleQuartier: 'ZONE_INDUSTRIELLE', travailType: 'SALARIE',
    });

    const res = await request(app)
      .get(`${API}/${proposal.id}/stats?segmentBy=travailleQuartier`)
      .set('Authorization', `Bearer ${token}`);

    const byValue = Object.fromEntries(res.body.segmentedBy.segments.map((s) => [s.value, s]));
    expect(byValue.ZONE_INDUSTRIELLE).toEqual({
      value: 'ZONE_INDUSTRIELLE', masked: true, totalVotes: null, votes: null,
    });
    // Les 5 qui ne travaillent pas à Senlis (travailleQuartier null) : visibles
    expect(byValue.null).toMatchObject({ masked: false, totalVotes: 5, votes: { POUR: 5, CONTRE: 0, NEUTRE: 0 } });
    // Le total global, lui, reste exact et complet
    expect(res.body.totalVotes).toBe(7);
    expect(res.body.votes).toEqual({ POUR: 5, CONTRE: 2, NEUTRE: 0 });
  });

  it("un vote dont l'auteur a supprimé son compte n'existe plus (cascade) — il ne fausse aucun segment", async () => {
    const proposal = await seedProposal();
    const { token } = await makeAdminUser();
    await seedVotes(proposal.id, 5, 'POUR', { situation: 'CENTRE_RESIDENT' });
    const leaving = await seedUser({ situation: 'CENTRE_RESIDENT' });
    await prisma.vote.create({ data: { userId: leaving.id, proposalId: proposal.id, value: 'CONTRE' } });
    await prisma.user.delete({ where: { id: leaving.id } });

    const res = await request(app)
      .get(`${API}/${proposal.id}/stats?segmentBy=situation`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.totalVotes).toBe(5);
    const centre = res.body.segmentedBy.segments.find((s) => s.value === 'CENTRE_RESIDENT');
    expect(centre.votes).toEqual({ POUR: 5, CONTRE: 0, NEUTRE: 0 });
  });
});
