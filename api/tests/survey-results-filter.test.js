// ══════════════════════════════════════════════════════════
// Tests — résultats filtrés par public (S5R-08)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeCitizen } from './helpers.js';

const API = '/api/v1/surveys';

/**
 * Enquête : Q0 Oui/Non, Q1 texte libre, Q2 affichée seulement si Q0 = Non.
 * 6 habitant·es du centre répondent Oui ; 3 personnes hors Senlis, Non.
 */
async function setup(audience) {
  const admin = await makeAdminUser();
  const created = await request(app).post(API).set('Authorization', `Bearer ${admin.token}`).send({
    title: 'Enquête filtrable', description: 'Une description suffisamment longue', status: 'OPEN', audience,
    questions: [
      { label: 'Êtes-vous satisfait·e ?', type: 'OUI_NON' },
      { label: 'Un commentaire ?', type: 'TEXTE_LIBRE', required: false },
      { label: 'Pourquoi pas ?', type: 'TEXTE_LIBRE', showIf: { questionOrder: 0, optionOrder: 1 } },
    ],
  });
  const survey = created.body.survey;
  const [q0, q1, q2] = survey.questions;

  const respond = async (situation, optionIndex, extra = []) => {
    const c = await makeCitizen();
    await prisma.user.update({ where: { id: c.user.id }, data: { situation } });
    const res = await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${c.token}`)
      .send({ answers: [{ questionId: q0.id, optionId: q0.options[optionIndex].id }, ...extra] });
    expect(res.status).toBe(201);
  };
  for (let i = 0; i < 6; i++) await respond('CENTRE_RESIDENT', 0, [{ questionId: q1.id, valueText: `Avis du centre ${i}` }]);
  for (let i = 0; i < 3; i++) await respond('HORS_SENLIS', 1, [{ questionId: q2.id, valueText: 'Trop loin' }]);

  const stats = (query = '') => request(app).get(`${API}/${survey.id}/stats${query}`).set('Authorization', `Bearer ${admin.token}`);
  return { stats, q0 };
}

describe('GET /surveys/:id/stats — public analysé', () => {
  it('sans filtre : tous les répondants (comportement d’avant), texte libre brut compris', async () => {
    const { stats } = await setup();
    const res = await stats();
    expect(res.body.totalResponses).toBe(9);
    expect(res.body.filter).toEqual({ scope: 'all' });
    expect(res.body.questions[1].answers).toHaveLength(6);
  });

  it('filtre personnalisé : seulement les habitant·es du centre, sans texte libre brut', async () => {
    const { stats, q0 } = await setup();
    const res = await stats('?scope=custom&situations=CENTRE_RESIDENT');

    expect(res.body.totalResponses).toBe(6);
    const oui = res.body.questions.find((q) => q.id === q0.id).options[0];
    expect(oui).toMatchObject({ count: 6, percentage: 100 });
    expect(res.body.questions[1].answers).toBeUndefined(); // pas de texte brut recoupé avec un profil
    expect(res.body.questions[1].totalAnswered).toBe(6);
  });

  it('groupe de moins de 5 répondants : il existe, mais rien de ce qu’il a répondu (secret statistique)', async () => {
    const { stats } = await setup();
    const res = await stats('?scope=custom&situations=HORS_SENLIS');
    expect(res.body).toMatchObject({ masked: true, totalResponses: null, questions: [], minGroupSize: 5 });
  });

  it('dans un groupe assez grand, une question vue par moins de 5 de ses membres est masquée', async () => {
    const { stats } = await setup();
    // Tout Senlis et hors Senlis : 9 répondants ; « Pourquoi pas ? » n'a été vue que par 3
    const res = await stats('?scope=custom&situations=CENTRE_RESIDENT,HORS_SENLIS');
    expect(res.body.totalResponses).toBe(9);
    const pourquoi = res.body.questions.find((q) => q.label === 'Pourquoi pas ?');
    expect(pourquoi).toMatchObject({ masked: true, totalForQuestion: null });
  });

  it("scope=target : le public visé de l'enquête elle-même", async () => {
    const { stats } = await setup({ situations: ['CENTRE_RESIDENT'] });
    const res = await stats('?scope=target');
    expect(res.body.totalResponses).toBe(6);
    expect(res.body.filter.audience.situations).toEqual(['CENTRE_RESIDENT']);
  });

  it('refuse un critère inconnu', async () => {
    const { stats } = await setup();
    const res = await stats('?scope=custom&situations=MARS');
    expect(res.status).toBe(400);
  });
});
