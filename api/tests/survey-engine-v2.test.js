// ══════════════════════════════════════════════════════════
// Tests — Moteur d'enquête v2 (S5R-05)
//
// Les scénarios viennent tous de la recette du 30/09 sur l'enquête
// stationnement : « 0 véhicule → fin », « pas plus de lieux cochés que
// de véhicules », « véhicules pro : Oui → au moins 1 », « questions du
// centre si on y réside OU si on y vient en voiture », « travaille à
// Senlis : Non » mémorisé dans le profil.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeCitizen, buildUser } from './helpers.js';
import { visibleQuestionIds } from '../src/lib/surveyFlow.js';

const API = '/api/v1/surveys';

/** Crée et ouvre une enquête via l'API, renvoie l'enquête (avec ses id). */
async function createSurvey(adminToken, questions) {
  const res = await request(app).post(API).set('Authorization', `Bearer ${adminToken}`).send({
    title: 'Enquête de test v2', description: 'Une description suffisamment longue', status: 'OPEN', questions,
  });
  expect(res.status).toBe(201);
  return res.body.survey;
}

const submit = (token, surveyId, answers) => request(app)
  .post(`${API}/${surveyId}/responses`).set('Authorization', `Bearer ${token}`).send({ answers });

// ── Le moteur seul (fonction pure) ───────────────────────
describe('visibleQuestionIds', () => {
  const questions = [
    { id: 'q0', order: 0, conditionOptionIds: [], options: [{ id: 'centre' }, { id: 'ailleurs' }] },
    { id: 'q1', order: 1, conditionOptionIds: [], options: [{ id: 'voiture' }, { id: 'velo' }] },
    // affichée si « centre » OU « voiture »
    { id: 'q2', order: 2, conditionOptionIds: ['centre', 'voiture'], options: [{ id: 'zero', endsSurvey: true }, { id: 'un' }] },
    { id: 'q3', order: 3, conditionOptionIds: [] },
  ];
  const run = (answers) => visibleQuestionIds(questions, (id) => answers[id] ?? []);

  it("OU : la question s'affiche si l'UNE des conditions est remplie", () => {
    expect(run({ q0: ['ailleurs'], q1: ['voiture'] })).toEqual(['q0', 'q1', 'q2', 'q3']);
    expect(run({ q0: ['centre'], q1: ['velo'] })).toEqual(['q0', 'q1', 'q2', 'q3']);
    expect(run({ q0: ['ailleurs'], q1: ['velo'] })).toEqual(['q0', 'q1', 'q3']);
  });

  it('fin anticipée : plus rien après une option « termine l’enquête »', () => {
    expect(run({ q0: ['centre'], q1: ['velo'], q2: ['zero'] })).toEqual(['q0', 'q1', 'q2']);
  });
});

// ── Dans l'API ───────────────────────────────────────────
describe("Conditions multiples (OU) et fin anticipée — à travers l'API", () => {
  it("crée une enquête avec showIfAny, renvoie conditionOptionIds, et rend la question obligatoire pour qui la voit", async () => {
    const { token } = await makeAdminUser();
    const survey = await createSurvey(token, [
      { label: 'Où résidez-vous ?', type: 'CHOIX_UNIQUE', options: [{ label: 'Centre' }, { label: 'Ailleurs' }] },
      { label: 'Venez-vous en voiture ?', type: 'OUI_NON' },
      {
        label: 'Où vous garez-vous ?', type: 'TEXTE_LIBRE',
        showIfAny: [{ questionOrder: 0, optionOrder: 0 }, { questionOrder: 1, optionOrder: 0 }],
      },
    ]);
    const [q0, q1, q2] = survey.questions;
    expect(q2.conditionOptionIds).toHaveLength(2);

    const citizen = await makeCitizen();
    // « Ailleurs » mais « en voiture » → q2 vue, donc obligatoire
    const missing = await submit(citizen.token, survey.id, [
      { questionId: q0.id, optionId: q0.options[1].id },
      { questionId: q1.id, optionId: q1.options[0].id },
    ]);
    expect(missing.status).toBe(400);
    expect(missing.body.error.message).toMatch(/Où vous garez-vous/);
  });

  it("une option qui termine l'enquête dispense des questions suivantes, et leurs réponses éventuelles sont ignorées", async () => {
    const { token } = await makeAdminUser();
    const survey = await createSurvey(token, [
      { label: 'Combien de véhicules ?', type: 'CHOIX_UNIQUE', options: [{ label: 'Aucun', endsSurvey: true }, { label: 'Un ou plus' }] },
      { label: 'Où sont-ils garés ?', type: 'TEXTE_LIBRE' },
    ]);
    const [q0, q1] = survey.questions;
    expect(q0.options[0].endsSurvey).toBe(true);

    const citizen = await makeCitizen();
    const res = await submit(citizen.token, survey.id, [
      { questionId: q0.id, optionId: q0.options[0].id },
      { questionId: q1.id, valueText: 'réponse qui ne doit pas être gardée' },
    ]);
    expect(res.status).toBe(201);
    expect(await prisma.answer.count({ where: { questionId: q1.id } })).toBe(0);
  });

  it("les résultats comptent, pour chaque question, les personnes qui l'ont VUE (OU et fins anticipées compris)", async () => {
    const admin = await makeAdminUser();
    const survey = await createSurvey(admin.token, [
      { label: 'Combien de véhicules ?', type: 'CHOIX_UNIQUE', options: [{ label: 'Aucun', endsSurvey: true }, { label: 'Un ou plus' }] },
      { label: 'Où sont-ils garés ?', type: 'TEXTE_LIBRE', required: false },
    ]);
    const [q0] = survey.questions;
    for (const option of [q0.options[0], q0.options[1], q0.options[1]]) {
      const c = await makeCitizen();
      await submit(c.token, survey.id, [{ questionId: q0.id, optionId: option.id }]);
    }

    const res = await request(app).get(`${API}/${survey.id}/stats`).set('Authorization', `Bearer ${admin.token}`);
    const totals = Object.fromEntries(res.body.questions.map((q) => [q.label, q.totalForQuestion]));
    expect(totals).toEqual({ 'Combien de véhicules ?': 3, 'Où sont-ils garés ?': 2 });
  });
});

describe('Bornes et limites', () => {
  it('NOMBRE : refuse une valeur hors des bornes min/max', async () => {
    const { token } = await makeAdminUser();
    const survey = await createSurvey(token, [
      { label: 'Combien de véhicules professionnels ?', type: 'NOMBRE', minValue: 1, maxValue: 20 },
    ]);
    const [q] = survey.questions;
    const citizen = await makeCitizen();

    const tooLow = await submit(citizen.token, survey.id, [{ questionId: q.id, valueNumber: 0 }]);
    expect(tooLow.status).toBe(400);
    expect(tooLow.body.error.message).toMatch(/au moins 1/);

    const ok = await submit(citizen.token, survey.id, [{ questionId: q.id, valueNumber: 2 }]);
    expect(ok.status).toBe(201);
  });

  it('CHOIX_MULTIPLE : pas plus de cases cochées que la réponse à la question « Nombre » de référence', async () => {
    const { token } = await makeAdminUser();
    const survey = await createSurvey(token, [
      { label: 'Combien de véhicules ?', type: 'NOMBRE', minValue: 0 },
      {
        label: 'Où sont-ils garés ?', type: 'CHOIX_MULTIPLE', maxChoicesFrom: { questionOrder: 0 },
        options: [{ label: 'Garage' }, { label: 'Rue' }, { label: 'Parking' }],
      },
    ]);
    const [qNb, qWhere] = survey.questions;
    expect(qWhere.maxChoicesFromId).toBe(qNb.id);
    const allThree = qWhere.options.map((o) => o.id);

    const first = await makeCitizen();
    const tooMany = await submit(first.token, survey.id, [
      { questionId: qNb.id, valueNumber: 2 },
      { questionId: qWhere.id, optionIds: allThree },
    ]);
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toMatch(/2 réponses au maximum/);

    const ok = await submit(first.token, survey.id, [
      { questionId: qNb.id, valueNumber: 2 },
      { questionId: qWhere.id, optionIds: allThree.slice(0, 2) },
    ]);
    expect(ok.status).toBe(201);
  });

  it('refuse à la création une limite qui ne vient pas d’une question « Nombre » précédente', async () => {
    const { token } = await makeAdminUser();
    const res = await request(app).post(API).set('Authorization', `Bearer ${token}`).send({
      title: 'Enquête invalide', description: 'Une description suffisamment longue', questions: [
        { label: 'Votre situation ?', type: 'OUI_NON' },
        { label: 'Où garez-vous ?', type: 'CHOIX_MULTIPLE', maxChoicesFrom: { questionOrder: 0 }, options: [{ label: 'A' }, { label: 'B' }] },
      ],
    });
    expect(res.status).toBe(400);
  });

  it('Zod refuse des réglages incohérents (bornes sur un texte, min > max)', async () => {
    const { token } = await makeAdminUser();
    for (const question of [
      { label: 'Votre avis ?', type: 'TEXTE_LIBRE', minValue: 1 },
      { label: 'Combien de vélos ?', type: 'NOMBRE', minValue: 5, maxValue: 1 },
    ]) {
      const res = await request(app).post(API).set('Authorization', `Bearer ${token}`)
        .send({ title: 'Enquête invalide', description: 'Une description suffisamment longue', questions: [question] });
      expect(res.status).toBe(400);
    }
  });
});

describe('Profil « travaille à Senlis » explicite', () => {
  it('une question Oui/Non synchronisée enregistre « non » dans le profil et efface le volet travail', async () => {
    const { token } = await makeAdminUser();
    const survey = await createSurvey(token, [
      { label: 'Travaillez-vous à Senlis ?', type: 'OUI_NON', syncsToProfile: 'travailleASenlis' },
    ]);
    const [q] = survey.questions;
    expect(q.options.map((o) => o.syncValue)).toEqual(['true', 'false']); // posés automatiquement

    const citizen = await makeCitizen();
    await prisma.user.update({ where: { id: citizen.user.id }, data: { travailleQuartier: 'BRICHEBAY', travailType: 'SALARIE', travailleASenlis: true } });

    await submit(citizen.token, survey.id, [{ questionId: q.id, optionId: q.options[1].id }]); // « Non »

    const user = await prisma.user.findUnique({ where: { id: citizen.user.id } });
    expect(user).toMatchObject({ travailleASenlis: false, travailleQuartier: null, travailType: null });
  });

  it("à l'inscription : case décochée = « non », quartier de travail = « oui »", async () => {
    const no = buildUser({ travailleASenlis: false });
    const yes = buildUser({ travailleQuartier: 'BRICHEBAY', travailType: 'SALARIE' });
    await request(app).post('/api/v1/auth/register').send(no);
    await request(app).post('/api/v1/auth/register').send(yes);

    expect((await prisma.user.findUnique({ where: { email: no.email } })).travailleASenlis).toBe(false);
    expect((await prisma.user.findUnique({ where: { email: yes.email } })).travailleASenlis).toBe(true);
  });
});

describe('Modifier une enquête', () => {
  it("changer SEULEMENT une condition (sans réponse) est bien enregistré — c'était ignoré avant S5R-05", async () => {
    const { token } = await makeAdminUser();
    const questions = [
      { label: 'Où résidez-vous ?', type: 'CHOIX_UNIQUE', options: [{ label: 'Centre' }, { label: 'Ailleurs' }] },
      { label: 'Une précision ?', type: 'TEXTE_LIBRE', showIf: { questionOrder: 0, optionOrder: 0 } },
    ];
    const survey = await createSurvey(token, questions);

    const updated = await request(app).patch(`${API}/${survey.id}`).set('Authorization', `Bearer ${token}`).send({
      questions: [questions[0], { ...questions[1], showIf: { questionOrder: 0, optionOrder: 1 } }],
    });
    expect(updated.status).toBe(200);
    const newCondition = updated.body.survey.questions[1].conditionOptionIds[0];
    expect(newCondition).toBe(updated.body.survey.questions[0].options[1].id);
  });
});
