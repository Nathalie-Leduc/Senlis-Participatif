// ══════════════════════════════════════════════════════════
// Tests — mode test de l'administration (S5R2-01)
// « Voir = Tester » : l'admin rejoue l'enquête autant de fois qu'il
// veut, avec la vraie validation, sans que rien ne soit enregistré.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeCitizen } from './helpers.js';

const API = '/api/v1/surveys';

/** Enquête : Q0 véhicule ? (« Non » termine), Q1 combien (≥ 1), Q2 profil travail */
async function setup(status = 'DRAFT') {
  const admin = await makeAdminUser();
  const res = await request(app).post(API).set('Authorization', `Bearer ${admin.token}`).send({
    title: 'Enquête à tester', description: 'Une description suffisamment longue', status,
    questions: [
      { label: 'Avez-vous un véhicule ?', type: 'OUI_NON', options: [{ label: 'Oui' }, { label: 'Non', endsSurvey: true }] },
      { label: 'Combien ?', type: 'NOMBRE', minValue: 1, showIf: { questionOrder: 0, optionOrder: 0 } },
      { label: 'Travaillez-vous à Senlis ?', type: 'OUI_NON', syncsToProfile: 'travailleASenlis' },
    ],
  });
  expect(res.status).toBe(201);
  const survey = res.body.survey;
  const [q0, q1, q2] = survey.questions;
  const test = (answers, token = admin.token) => request(app)
    .post(`${API}/${survey.id}/test`).set('Authorization', `Bearer ${token}`).send({ answers });
  return { admin, survey, q0, q1, q2, test };
}

describe('Mode test de l’administration', () => {
  it('rejoue le parcours (même un brouillon) et ne renvoie rien d’enregistré', async () => {
    const { q0, q1, q2, test, admin } = await setup('DRAFT');
    const res = await test([
      { questionId: q0.id, optionId: q0.options[0].id },
      { questionId: q1.id, valueNumber: 2 },
      { questionId: q2.id, optionId: q2.options[1].id },
    ]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ test: true, saved: false, totalQuestions: 3 });
    expect(res.body.path.map((p) => p.label)).toEqual(['Avez-vous un véhicule ?', 'Combien ?', 'Travaillez-vous à Senlis ?']);
    expect(res.body.profileWouldUpdate).toContain('travailleASenlis');

    // Rien en base : ni réponse, ni profil modifié
    expect(await prisma.surveyResponse.count()).toBe(0);
    expect(await prisma.answer.count()).toBe(0);
    const user = await prisma.user.findUnique({ where: { id: admin.user.id } });
    expect(user.travailleASenlis).toBeNull();
  });

  it('applique la VRAIE validation : bornes, questions obligatoires, fin anticipée', async () => {
    const { q0, q1, q2, test } = await setup();
    const tooLow = await test([
      { questionId: q0.id, optionId: q0.options[0].id },
      { questionId: q1.id, valueNumber: 0 },
      { questionId: q2.id, optionId: q2.options[0].id },
    ]);
    expect(tooLow.status).toBe(400);
    expect(tooLow.body.error.message).toMatch(/au moins 1/);

    const missing = await test([{ questionId: q0.id, optionId: q0.options[0].id }]);
    expect(missing.status).toBe(400);

    const ended = await test([{ questionId: q0.id, optionId: q0.options[1].id }]);
    expect(ended.status).toBe(200);
    expect(ended.body.path).toHaveLength(1); // « Non » termine l'enquête
  });

  it('se répète autant de fois qu’on veut', async () => {
    const { q0, test } = await setup();
    for (let i = 0; i < 3; i++) {
      const res = await test([{ questionId: q0.id, optionId: q0.options[1].id }]);
      expect(res.status).toBe(200);
    }
  });

  it('est réservé à l’administration', async () => {
    const { q0, test } = await setup('OPEN');
    const citizen = await makeCitizen();
    const res = await test([{ questionId: q0.id, optionId: q0.options[1].id }], citizen.token);
    expect(res.status).toBe(403);
  });

  it('une VRAIE réponse d’un compte admin est refusée (elle fausserait les résultats)', async () => {
    const { admin, survey, q0 } = await setup('OPEN');
    const res = await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${admin.token}`)
      .send({ answers: [{ questionId: q0.id, optionId: q0.options[1].id }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_CANNOT_RESPOND');
    expect(await prisma.surveyResponse.count()).toBe(0);
  });
});
