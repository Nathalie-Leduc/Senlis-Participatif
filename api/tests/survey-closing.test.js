// ══════════════════════════════════════════════════════════
// Tests — clôture d'une enquête et suppression en développement
// (recette du 13/10)
//
// Deux façons de clôturer :
//  - « maintenant » (arrêt ou annulation) : status CLOSED tout de suite ;
//  - « à une date précise » : closesAt dans le futur, l'enquête reste
//    OPEN puis passe d'elle-même en CLOSED une fois la date passée.
//
// Analogie : fermer la boutique tout de suite (on baisse le rideau) ou
// afficher « fermeture définitive le 31 » (le rideau baisse ce jour-là).
//
// Et la suppression d'une enquête qui a des réponses : possible pour un
// ADMIN en développement (?avecReponses=1), jamais en production.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeEditorUser, seedSurvey, seedUser } from './helpers.js';

const API = '/api/v1/surveys';
const as = (token) => ({ Authorization: `Bearer ${token}` });
const DAY = 24 * 60 * 60 * 1000;

/** Une réponse écrite directement en base (plus court que le parcours complet) */
async function addResponse(survey) {
  const user = await seedUser();
  const [q0] = survey.questions;
  return prisma.surveyResponse.create({
    data: {
      userId: user.id,
      surveyId: survey.id,
      answers: { create: [{ questionId: q0.id, optionId: q0.options[0].id }] },
    },
  });
}

describe('Clôture programmée', () => {
  it('une date de clôture passée fait passer l’enquête en CLOSED dès la lecture suivante', async () => {
    const survey = await seedSurvey({ closesAt: new Date(Date.now() - DAY) });
    const res = await request(app).get(`${API}/${survey.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.survey.status).toBe('CLOSED');
    expect((await prisma.survey.findUnique({ where: { id: survey.id } })).status).toBe('CLOSED');
  });

  it('une date future laisse l’enquête OUVERTE', async () => {
    const survey = await seedSurvey({ closesAt: new Date(Date.now() + DAY) });
    await request(app).get(API);
    expect((await prisma.survey.findUnique({ where: { id: survey.id } })).status).toBe('OPEN');
  });

  it('la liste admin applique aussi la clôture automatique', async () => {
    const admin = await makeAdminUser();
    const survey = await seedSurvey({ closesAt: new Date(Date.now() - DAY) });
    const res = await request(app).get(`${API}/admin`).set(as(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.items.find((s) => s.id === survey.id).status).toBe('CLOSED');
  });

  it('programmer une date : PATCH closesAt seul, le statut ne change pas', async () => {
    const admin = await makeAdminUser();
    const survey = await seedSurvey();
    const closesAt = new Date(Date.now() + 7 * DAY).toISOString();
    const res = await request(app).patch(`${API}/${survey.id}`).set(as(admin.token)).send({ closesAt });
    expect(res.status).toBe(200);
    expect(res.body.survey.status).toBe('OPEN');
    expect(new Date(res.body.survey.closesAt).toISOString()).toBe(closesAt);
  });

  it('rouvrir : closesAt null efface la date (et ne devient pas le 1er janvier 1970)', async () => {
    const admin = await makeAdminUser();
    const survey = await seedSurvey({ status: 'CLOSED', closesAt: new Date(Date.now() - DAY) });
    const res = await request(app).patch(`${API}/${survey.id}`).set(as(admin.token)).send({ status: 'OPEN', closesAt: null });
    expect(res.status).toBe(200);
    expect(res.body.survey.closesAt).toBeNull();

    // Et la lecture suivante ne la referme pas
    await request(app).get(`${API}/${survey.slug}`);
    expect((await prisma.survey.findUnique({ where: { id: survey.id } })).status).toBe('OPEN');
  });
});

describe('Rouvrir avec une date de clôture passée (recette du 14/10)', () => {
  it('statut OPEN + date passée : refusé avec un message clair, rien ne change', async () => {
    const admin = await makeAdminUser();
    const past = new Date(Date.now() - DAY);
    const survey = await seedSurvey({ status: 'CLOSED', closesAt: past });
    // Ce qu'envoyait le formulaire « Modifier » : le statut ET l'ancienne date
    const res = await request(app).patch(`${API}/${survey.id}`).set(as(admin.token))
      .send({ status: 'OPEN', closesAt: past.toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CLOSES_AT_PAST');
    expect(res.body.error.message).toMatch(/déjà passée/);
    expect((await prisma.survey.findUnique({ where: { id: survey.id } })).status).toBe('CLOSED');
  });

  it('statut OPEN seul, la date passée restant en base : refusé aussi', async () => {
    const admin = await makeAdminUser();
    const survey = await seedSurvey({ status: 'CLOSED', closesAt: new Date(Date.now() - DAY) });
    const res = await request(app).patch(`${API}/${survey.id}`).set(as(admin.token)).send({ status: 'OPEN' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CLOSES_AT_PAST');
  });

  it('statut OPEN + nouvelle date à venir : accepté, et reste ouverte', async () => {
    const admin = await makeAdminUser();
    const survey = await seedSurvey({ status: 'CLOSED', closesAt: new Date(Date.now() - DAY) });
    const res = await request(app).patch(`${API}/${survey.id}`).set(as(admin.token))
      .send({ status: 'OPEN', closesAt: new Date(Date.now() + DAY).toISOString() });
    expect(res.status).toBe(200);
    await request(app).get(`${API}/${survey.slug}`);
    expect((await prisma.survey.findUnique({ where: { id: survey.id } })).status).toBe('OPEN');
  });

  it('une enquête CLÔTURÉE peut garder sa date passée (modifier autre chose)', async () => {
    const admin = await makeAdminUser();
    const past = new Date(Date.now() - DAY);
    const survey = await seedSurvey({ status: 'CLOSED', closesAt: past });
    const res = await request(app).patch(`${API}/${survey.id}`).set(as(admin.token))
      .send({ status: 'CLOSED', closesAt: past.toISOString(), title: 'Nouveau titre de l’enquête' });
    expect(res.status).toBe(200);
  });
});

describe('Suppression d’une enquête qui a des réponses', () => {
  const NODE_ENV = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = NODE_ENV; });

  it('sans le demander explicitement : 409, avec le nombre de réponses et canForce', async () => {
    const admin = await makeAdminUser();
    const survey = await seedSurvey();
    await addResponse(survey);
    const res = await request(app).delete(`${API}/${survey.id}`).set(as(admin.token));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SURVEY_HAS_RESPONSES');
    expect(res.body.error.details).toEqual({ responses: 1, canForce: true });
  });

  it('en développement, un ADMIN peut supprimer AVEC les réponses (?avecReponses=1), noté au journal', async () => {
    const admin = await makeAdminUser();
    const survey = await seedSurvey();
    await addResponse(survey);
    await addResponse(survey);

    const res = await request(app).delete(`${API}/${survey.id}?avecReponses=1`).set(as(admin.token));
    expect(res.status).toBe(204);
    expect(await prisma.survey.findUnique({ where: { id: survey.id } })).toBeNull();
    expect(await prisma.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);

    const log = await prisma.adminAuditLog.findFirst({ where: { targetId: survey.id, action: 'SURVEY_DELETED' } });
    expect(log.details).toMatchObject({ responsesDeleted: 2 });
  });

  it('en production : toujours refusé, même en le demandant', async () => {
    const admin = await makeAdminUser();
    const survey = await seedSurvey();
    await addResponse(survey);

    process.env.NODE_ENV = 'production';
    const res = await request(app).delete(`${API}/${survey.id}?avecReponses=1`).set(as(admin.token));
    expect(res.status).toBe(409);
    expect(res.body.error.details.canForce).toBe(false);
    expect(res.body.error.message).toMatch(/clôturez-la/);
    expect(await prisma.survey.findUnique({ where: { id: survey.id } })).not.toBeNull();
  });

  it('un EDITOR ne peut pas forcer (il ne supprime que des brouillons)', async () => {
    const editor = await makeEditorUser();
    const survey = await seedSurvey({ status: 'DRAFT' });
    await addResponse(survey);
    const res = await request(app).delete(`${API}/${survey.id}?avecReponses=1`).set(as(editor.token));
    expect(res.status).toBe(409);
    expect(res.body.error.details.canForce).toBe(false);
  });
});
