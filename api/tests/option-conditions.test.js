// ══════════════════════════════════════════════════════════
// Tests — options conditionnelles (S5R2-02)
//
// Cas de la recette du 08/10 : « Bus régional » ne doit être proposé
// comme moyen de transport qu'aux personnes qui résident dans une AUTRE
// ville. Analogie : un menu du jour où le plat « enfant » n'apparaît
// que si on a coché « j'ai des enfants » plus haut.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeCitizen, seedUser } from './helpers.js';
import { surveyPath, offeredOptionIds } from '../src/lib/surveyFlow.js';

const API = '/api/v1/surveys';
const as = (token) => ({ Authorization: `Bearer ${token}` });

// Q0 : où résidez-vous ? — Q1 : comment venez-vous ? (« Bus régional »
// seulement si « Autre ville ») — Q2 : quelle ligne ? (seulement si « Bus régional »)
const QUESTIONS = [
  { label: 'Où résidez-vous ?', type: 'CHOIX_UNIQUE', options: [{ label: 'Senlis' }, { label: 'Autre ville' }] },
  {
    label: 'Comment venez-vous au centre ?', type: 'CHOIX_MULTIPLE',
    options: [
      { label: 'À pied' },
      { label: 'Voiture' },
      { label: 'Bus régional', showIfAny: [{ questionOrder: 0, optionOrder: 1 }] },
    ],
  },
  { label: 'Quelle ligne de bus ?', type: 'TEXTE_LIBRE', required: false, showIfAny: [{ questionOrder: 1, optionOrder: 2 }] },
];

async function createSurvey(questions = QUESTIONS) {
  const admin = await makeAdminUser();
  const res = await request(app).post(API).set(as(admin.token)).send({
    title: 'Venir au centre', description: 'Une description suffisamment longue', status: 'OPEN', questions,
  });
  return { admin, res, survey: res.body.survey };
}

// ── Le moteur seul ───────────────────────────────────────
describe('Moteur — options proposées', () => {
  const questions = [
    { id: 'q0', order: 0, options: [{ id: 'senlis' }, { id: 'ailleurs' }] },
    { id: 'q1', order: 1, options: [{ id: 'pied' }, { id: 'bus', conditionOptionIds: ['ailleurs'] }] },
    { id: 'q2', order: 2, conditionOptionIds: ['bus'] },
    // Toutes ses options sont conditionnelles : sautée si aucune n'est proposée
    { id: 'q3', order: 3, options: [{ id: 'abo', conditionOptionIds: ['ailleurs'] }] },
  ];
  const run = (answers) => surveyPath(questions, (id) => answers[id] ?? []);

  it('« Bus régional » n’est proposé qu’à qui réside ailleurs', () => {
    expect(run({ q0: ['senlis'] }).offeredOptions.get('q1')).toEqual(['pied']);
    expect(run({ q0: ['ailleurs'] }).offeredOptions.get('q1')).toEqual(['pied', 'bus']);
  });

  it('un choix parmi des options NON proposées ne déclenche rien', () => {
    // « bus » envoyé alors qu'il n'était pas proposé : q2 reste cachée
    expect(run({ q0: ['senlis'], q1: ['bus'] }).questionIds).toEqual(['q0', 'q1']);
    expect(run({ q0: ['ailleurs'], q1: ['bus'] }).questionIds).toEqual(['q0', 'q1', 'q2', 'q3']);
  });

  it('une question dont aucune option n’est proposée est sautée', () => {
    expect(run({ q0: ['senlis'] }).questionIds).not.toContain('q3');
  });

  it('offeredOptionIds : sans condition, toujours proposée', () => {
    expect(offeredOptionIds({ options: [{ id: 'a' }, { id: 'b', conditionOptionIds: [] }] }, new Set())).toEqual(['a', 'b']);
  });
});

// ── À travers l'API ──────────────────────────────────────
describe('Options conditionnelles — création', () => {
  it('enregistre la condition et la renvoie (conditionOptionIds sur l’option)', async () => {
    const { res, survey } = await createSurvey();
    expect(res.status).toBe(201);
    const [q0, q1] = survey.questions;
    expect(q1.options[2].conditionOptionIds).toEqual([q0.options[1].id]);
    expect(q1.options[0].conditionOptionIds).toEqual([]);
  });

  it('refuse un déclencheur pris dans la même question ou une question suivante', async () => {
    const { res } = await createSurvey([
      { label: 'Première question ?', type: 'CHOIX_UNIQUE', options: [{ label: 'A' }, { label: 'B', showIfAny: [{ questionOrder: 1, optionOrder: 0 }] }] },
      { label: 'Deuxième question ?', type: 'OUI_NON' },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/question qui la précède/);
  });
});

describe('Options conditionnelles — réponses', () => {
  const submit = (token, surveyId, answers) => request(app)
    .post(`${API}/${surveyId}/responses`).set(as(token)).send({ answers });

  it('refuse une option qui n’était pas proposée (résidente de Senlis + « Bus régional »)', async () => {
    const { survey } = await createSurvey();
    const [q0, q1] = survey.questions;
    const citizen = await makeCitizen();

    const res = await submit(citizen.token, survey.id, [
      { questionId: q0.id, optionId: q0.options[0].id }, // Senlis
      { questionId: q1.id, optionIds: [q1.options[0].id, q1.options[2].id] }, // à pied + bus régional
    ]);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/n'était pas proposée/);
    expect(await prisma.surveyResponse.count()).toBe(0);
  });

  it('accepte l’option quand elle était proposée, et ouvre la question qui en dépend', async () => {
    const { survey } = await createSurvey();
    const [q0, q1, q2] = survey.questions;
    const citizen = await makeCitizen();

    const res = await submit(citizen.token, survey.id, [
      { questionId: q0.id, optionId: q0.options[1].id }, // autre ville
      { questionId: q1.id, optionIds: [q1.options[2].id] }, // bus régional
      { questionId: q2.id, valueText: 'Ligne 645' },
    ]);
    expect(res.status).toBe(201);
    const saved = await prisma.answer.findMany({ where: { questionId: q2.id } });
    expect(saved.map((a) => a.valueText)).toEqual(['Ligne 645']);
  });

  it('le mode test applique la même règle', async () => {
    const { admin, survey } = await createSurvey();
    const [q0, q1] = survey.questions;
    const res = await request(app).post(`${API}/${survey.id}/test`).set(as(admin.token)).send({
      answers: [
        { questionId: q0.id, optionId: q0.options[0].id },
        { questionId: q1.id, optionIds: [q1.options[2].id] },
      ],
    });
    expect(res.status).toBe(400);
  });
});

describe('Options conditionnelles — résultats', () => {
  it('indique à combien de personnes l’option conditionnelle a été proposée', async () => {
    const { admin, survey } = await createSurvey();
    const [q0, q1] = survey.questions;
    // 6 répondants écrits en base : 2 d'une autre ville (dont 1 en bus), 4 de Senlis
    const people = [
      ['ailleurs', ['bus']], ['ailleurs', ['pied']],
      ['senlis', ['pied']], ['senlis', ['voiture']], ['senlis', ['pied']], ['senlis', ['voiture']],
    ];
    const optionOf = { senlis: q0.options[0].id, ailleurs: q0.options[1].id, pied: q1.options[0].id, voiture: q1.options[1].id, bus: q1.options[2].id };
    for (const [home, ways] of people) {
      const user = await seedUser();
      await prisma.surveyResponse.create({
        data: {
          userId: user.id, surveyId: survey.id,
          answers: {
            create: [
              { questionId: q0.id, optionId: optionOf[home] },
              ...ways.map((w) => ({ questionId: q1.id, optionId: optionOf[w] })),
            ],
          },
        },
      });
    }

    const res = await request(app).get(`${API}/${survey.id}/stats`).set(as(admin.token));
    expect(res.status).toBe(200);
    const transport = res.body.questions.find((q) => q.id === q1.id);
    const bus = transport.options.find((o) => o.label === 'Bus régional');
    expect(bus).toMatchObject({ count: 1, offeredTo: 2 });
    expect(transport.options.find((o) => o.label === 'À pied').offeredTo).toBeUndefined();
  });
});

describe('Options conditionnelles — modification', () => {
  it('renvoyer le même questionnaire n’est pas un changement ; changer un déclencheur, si', async () => {
    const { admin, survey } = await createSurvey();
    const [q0, q1] = survey.questions;
    const citizen = await makeCitizen();
    await request(app).post(`${API}/${survey.id}/responses`).set(as(citizen.token)).send({
      answers: [{ questionId: q0.id, optionId: q0.options[0].id }, { questionId: q1.id, optionIds: [q1.options[0].id] }],
    });

    // Identique (déclencheur compris) : accepté malgré les réponses
    const same = await request(app).patch(`${API}/${survey.id}`).set(as(admin.token)).send({ questions: QUESTIONS });
    expect(same.status).toBe(200);

    // Déclencheur changé (« Senlis » au lieu de « Autre ville ») : c'est un vrai changement
    const changed = structuredClone(QUESTIONS);
    changed[1].options[2].showIfAny = [{ questionOrder: 0, optionOrder: 0 }];
    const res = await request(app).patch(`${API}/${survey.id}`).set(as(admin.token)).send({ questions: changed });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SURVEY_HAS_RESPONSES');
  });
});
