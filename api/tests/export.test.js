// ══════════════════════════════════════════════════════════
// Tests — Export de mes données (S5A-05)
// GET /api/v1/auth/me/export — droit d'accès et de portabilité
// (RGPD art. 15 et 20)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeCitizen, seedProposal, seedSurvey } from './helpers.js';

const EXPORT = '/api/v1/auth/me/export';

describe('GET /auth/me/export', () => {
  it('401 sans authentification', async () => {
    const res = await request(app).get(EXPORT);
    expect(res.status).toBe(401);
  });

  it('renvoie un fichier JSON à télécharger, jamais mis en cache', async () => {
    const { token } = await makeCitizen();
    const res = await request(app).get(EXPORT).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="senlis-participatif-mes-donnees-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('contient le compte, les votes et les réponses — avec des libellés lisibles, pas des identifiants', async () => {
    const { user, token } = await makeCitizen();
    const proposal = await seedProposal({ title: 'Piétonniser la rue de Paris' });
    const survey = await seedSurvey({ title: 'Stationnement 2026' });
    const question = survey.questions[0];
    const oui = question.options.find((o) => o.label === 'Oui');

    await prisma.vote.create({ data: { userId: user.id, proposalId: proposal.id, value: 'CONTRE' } });
    await prisma.surveyResponse.create({
      data: { userId: user.id, surveyId: survey.id, answers: { create: [{ questionId: question.id, optionId: oui.id }] } },
    });

    const res = await request(app).get(EXPORT).set('Authorization', `Bearer ${token}`);

    expect(res.body.account).toMatchObject({ email: user.email, pseudo: user.pseudo, situation: 'CENTRE_RESIDENT' });
    expect(res.body.votes).toEqual([
      expect.objectContaining({ proposal: 'Piétonniser la rue de Paris', vote: 'CONTRE' }),
    ]);
    expect(res.body.surveyResponses).toHaveLength(1);
    expect(res.body.surveyResponses[0]).toMatchObject({
      survey: 'Stationnement 2026',
      answers: [{ question: question.label, answer: 'Oui' }],
    });
    expect(res.body.about).toMatch(/RGPD/);
  });

  it("n'exporte AUCUN secret : ni empreinte de mot de passe, ni jeton, ni identifiant interne", async () => {
    const { token } = await makeCitizen();
    const res = await request(app).get(EXPORT).set('Authorization', `Bearer ${token}`);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/passwordHash|tokenHash|\$argon2/);
    expect(res.body.account.id).toBeUndefined();
  });

  it("n'exporte que MES données, jamais celles d'un autre citoyen", async () => {
    const me = await makeCitizen();
    const other = await makeCitizen();
    const proposal = await seedProposal();
    await prisma.vote.create({ data: { userId: other.user.id, proposalId: proposal.id, value: 'POUR' } });

    const res = await request(app).get(EXPORT).set('Authorization', `Bearer ${me.token}`);

    expect(res.body.votes).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain(other.user.email);
  });
});
