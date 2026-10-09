// ══════════════════════════════════════════════════════════
// Tests — rôle « Admin-test » (EDITOR, S5R2-11)
//
// On rejoue, ligne par ligne, le tableau des permissions décidé le
// 09/10 (doc 29, § 8.4). Analogie : la cuisine d'un restaurant —
// l'apprenti prépare et goûte (brouillons, mode test), seul le chef
// envoie en salle (publier, ouvrir, voir les vraies réponses).
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { sendMailMock } from './setup.js';
import {
  makeAdminUser, makeEditorUser, makeCitizen, buildUser,
  extractTokenFromEmail, seedProposal, seedSurvey,
} from './helpers.js';

const PROPOSALS = '/api/v1/proposals';
const SURVEYS = '/api/v1/surveys';

const proposalBody = {
  title: 'Des bancs place Henri IV',
  summary: 'Ajouter quatre bancs à l’ombre des tilleuls.',
  content: 'Argumentaire : la place manque d’assises pour les personnes âgées.',
};
const surveyBody = {
  title: 'Enquête en préparation',
  description: 'Une description suffisamment longue pour Zod.',
  questions: [{ label: 'Êtes-vous d’accord ?', type: 'OUI_NON' }],
};

const as = (token) => ({ Authorization: `Bearer ${token}` });

describe('Admin-test — connexion', () => {
  it('passe par la double authentification, comme un admin', async () => {
    const credentials = buildUser();
    await request(app).post('/api/v1/auth/register').send(credentials);
    const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
    await request(app).post('/api/v1/auth/verify-email').send({ token: verifyToken });
    await prisma.user.update({ where: { email: credentials.email }, data: { role: 'EDITOR' } });

    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.body.twoFactorRequired).toBe(true);
    expect(res.body.token).toBeUndefined(); // pas de session avant le code
  });
});

describe('Admin-test — ce qu’il peut faire', () => {
  it('voit les listes d’administration (tous statuts) et les brouillons publics', async () => {
    const { token } = await makeEditorUser();
    const draft = await seedSurvey({ status: 'DRAFT' });

    expect((await request(app).get(`${PROPOSALS}/admin`).set(as(token))).status).toBe(200);
    expect((await request(app).get(`${SURVEYS}/admin`).set(as(token))).status).toBe(200);
    expect((await request(app).get(`${SURVEYS}/${draft.slug}`).set(as(token))).status).toBe(200);
  });

  it('crée, modifie et supprime un brouillon de proposition — et c’est journalisé', async () => {
    const { token, user } = await makeEditorUser();

    const created = await request(app).post(PROPOSALS).set(as(token)).send(proposalBody);
    expect(created.status).toBe(201);
    expect(created.body.proposal.status).toBe('DRAFT');
    const { id } = created.body.proposal;

    const updated = await request(app).patch(`${PROPOSALS}/${id}`).set(as(token))
      .send({ summary: 'Ajouter six bancs à l’ombre des tilleuls.', status: 'DRAFT' });
    expect(updated.status).toBe(200);

    expect((await request(app).delete(`${PROPOSALS}/${id}`).set(as(token))).status).toBe(204);

    const actions = await prisma.adminAuditLog.findMany({ where: { actorId: user.id, targetId: id } });
    expect(actions.map((a) => a.action).sort())
      .toEqual(['PROPOSAL_CREATED', 'PROPOSAL_DELETED', 'PROPOSAL_UPDATED']);
  });

  it('crée une enquête en brouillon et la teste (mode test)', async () => {
    const { token } = await makeEditorUser();
    const created = await request(app).post(SURVEYS).set(as(token)).send(surveyBody);
    expect(created.status).toBe(201);
    const survey = created.body.survey;
    expect(survey.status).toBe('DRAFT');

    const q = survey.questions[0];
    const test = await request(app).post(`${SURVEYS}/${survey.id}/test`).set(as(token))
      .send({ answers: [{ questionId: q.id, optionId: q.options[0].id }] });
    expect(test.status).toBe(200);
    expect(test.body.saved).toBe(false);
  });
});

describe('Admin-test — ce qu’il ne peut pas faire (403)', () => {
  it('publier à la création : refusé, rien n’est créé', async () => {
    const { token } = await makeEditorUser();

    const p = await request(app).post(PROPOSALS).set(as(token)).send({ ...proposalBody, status: 'PUBLISHED' });
    expect(p.status).toBe(403);
    expect(p.body.error.code).toBe('DRAFTS_ONLY');

    const s = await request(app).post(SURVEYS).set(as(token)).send({ ...surveyBody, status: 'OPEN' });
    expect(s.status).toBe(403);

    expect(await prisma.proposal.count()).toBe(0);
    expect(await prisma.survey.count()).toBe(0);
  });

  it('sortir un brouillon du brouillon (ouvrir, publier des résultats) : refusé, il reste DRAFT', async () => {
    const { token } = await makeEditorUser();
    const draft = await seedSurvey({ status: 'DRAFT' });

    const open = await request(app).patch(`${SURVEYS}/${draft.id}`).set(as(token)).send({ status: 'OPEN' });
    expect(open.status).toBe(403);
    const results = await request(app).patch(`${SURVEYS}/${draft.id}`).set(as(token)).send({ resultsPublished: true });
    expect(results.status).toBe(403);

    const after = await prisma.survey.findUnique({ where: { id: draft.id } });
    expect(after.status).toBe('DRAFT');
    expect(after.resultsPublished).toBe(false);
  });

  it('modifier, supprimer, tester ou illustrer un élément publié/ouvert : refusé', async () => {
    const { token } = await makeEditorUser();
    const published = await seedProposal(); // PUBLISHED
    const open = await seedSurvey(); // OPEN

    const checks = [
      request(app).patch(`${PROPOSALS}/${published.id}`).set(as(token)).send({ title: 'Titre modifié en douce' }),
      request(app).delete(`${PROPOSALS}/${published.id}`).set(as(token)),
      request(app).post(`${PROPOSALS}/${published.id}/image`).set(as(token)),
      request(app).patch(`${SURVEYS}/${open.id}`).set(as(token)).send({ title: 'Titre modifié en douce' }),
      request(app).delete(`${SURVEYS}/${open.id}`).set(as(token)),
      request(app).post(`${SURVEYS}/${open.id}/test`).set(as(token))
        .send({ answers: [{ questionId: open.questions[0].id, optionId: open.questions[0].options[0].id }] }),
    ];
    for (const res of await Promise.all(checks)) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DRAFTS_ONLY');
    }

    // Rien n'a bougé
    expect((await prisma.proposal.findUnique({ where: { id: published.id } })).title).toBe(published.title);
    expect(await prisma.survey.findUnique({ where: { id: open.id } })).not.toBeNull();
  });

  it('voir les vraies réponses et résultats détaillés, gérer les comptes : refusé', async () => {
    const { token } = await makeEditorUser();
    const citizen = await makeCitizen();
    const survey = await seedSurvey({ status: 'CLOSED' }); // résultats non publiés
    const proposal = await seedProposal();

    expect((await request(app).get(`${SURVEYS}/${survey.id}/stats`).set(as(token))).status).toBe(403);
    expect((await request(app).get(`${SURVEYS}/${survey.slug}/results`).set(as(token))).status).toBe(403);
    expect((await request(app).get(`${PROPOSALS}/${proposal.id}/stats`).set(as(token))).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/users').set(as(token))).status).toBe(403);
    expect((await request(app).patch(`/api/v1/admin/users/${citizen.user.id}`).set(as(token))
      .send({ role: 'ADMIN' })).status).toBe(403);
  });

  it('voter ou répondre pour de vrai : refusé (ne fausse pas les résultats)', async () => {
    const { token } = await makeEditorUser();
    const proposal = await seedProposal();
    const survey = await seedSurvey();

    const vote = await request(app).put(`${PROPOSALS}/${proposal.id}/vote`).set(as(token)).send({ value: 'POUR' });
    expect(vote.status).toBe(403);
    expect(vote.body.error.code).toBe('STAFF_CANNOT_VOTE');

    const q = survey.questions[0];
    const answer = await request(app).post(`${SURVEYS}/${survey.id}/responses`).set(as(token))
      .send({ answers: [{ questionId: q.id, optionId: q.options[0].id }] });
    expect(answer.status).toBe(403);
    expect(answer.body.error.code).toBe('ADMIN_CANNOT_RESPOND');

    expect(await prisma.vote.count()).toBe(0);
    expect(await prisma.surveyResponse.count()).toBe(0);
  });
});

describe('Administration — rôle Admin-test', () => {
  it('l’admin promeut un compte en Admin-test depuis « Comptes »', async () => {
    const admin = await makeAdminUser();
    const citizen = await makeCitizen();

    const res = await request(app).patch(`/api/v1/admin/users/${citizen.user.id}`).set(as(admin.token))
      .send({ role: 'EDITOR' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('EDITOR');
  });

  it('l’admin garde tous ses droits : il publie, et ne vote pas non plus', async () => {
    const { token } = await makeAdminUser();
    const created = await request(app).post(PROPOSALS).set(as(token)).send({ ...proposalBody, status: 'PUBLISHED' });
    expect(created.status).toBe(201);

    const vote = await request(app).put(`${PROPOSALS}/${created.body.proposal.id}/vote`).set(as(token)).send({ value: 'POUR' });
    expect(vote.status).toBe(403);
    expect(vote.body.error.code).toBe('STAFF_CANNOT_VOTE');
  });
});
