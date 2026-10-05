// ══════════════════════════════════════════════════════════
// Tests — public visé d'une enquête par critères de profil (S5R-07)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeCitizen } from './helpers.js';
import { matchesAudience } from '../src/lib/audience.js';

const API = '/api/v1/surveys';
const audienceOf = (a) => ({ situations: [], quartiers: [], workQuartiers: [], workTypes: [], ...a });

describe('matchesAudience', () => {
  const centre = { situation: 'CENTRE_RESIDENT' };
  const brichebay = { situation: 'AUTRE_QUARTIER', quartier: 'BRICHEBAY' };
  const commercantCentre = { situation: 'HORS_SENLIS', travailleASenlis: true, travailleQuartier: 'CENTRE_HISTORIQUE', travailType: 'COMMERCANT' };

  it('sans critère : tout le monde, même un profil vide', () => {
    expect(matchesAudience(audienceOf({}), {})).toBe(true);
  });

  it('résidence : situation, puis quartier pour « autre quartier »', () => {
    const a = audienceOf({ situations: ['AUTRE_QUARTIER'], quartiers: ['BRICHEBAY', 'VILLEVERT'] });
    expect(matchesAudience(a, brichebay)).toBe(true);
    expect(matchesAudience(a, { situation: 'AUTRE_QUARTIER', quartier: 'JARDINIERS' })).toBe(false);
    expect(matchesAudience(a, centre)).toBe(false);
  });

  it('travail : quartier ET rôle (« commerçant·es du centre »)', () => {
    const a = audienceOf({ workQuartiers: ['CENTRE_HISTORIQUE'], workTypes: ['COMMERCANT'] });
    expect(matchesAudience(a, commercantCentre)).toBe(true);
    expect(matchesAudience(a, { ...commercantCentre, travailType: 'SALARIE' })).toBe(false);
    expect(matchesAudience(a, { travailleASenlis: false })).toBe(false);
  });

  it('OU entre les deux familles : « habitants du centre OU commerçants du centre »', () => {
    const a = audienceOf({ situations: ['CENTRE_RESIDENT'], workQuartiers: ['CENTRE_HISTORIQUE'], workTypes: ['COMMERCANT'] });
    expect(matchesAudience(a, centre)).toBe(true);
    expect(matchesAudience(a, commercantCentre)).toBe(true);
    // Ne travaille pas à Senlis : ni l'une ni l'autre famille
    expect(matchesAudience(a, { ...brichebay, travailleASenlis: false })).toBe(false);
    // Volet travail jamais renseigné : peut-être commerçant·e du centre → on ne sait pas
    expect(matchesAudience(a, brichebay)).toBeNull();
  });

  it("profil incomplet : « on ne sait pas » (null), jamais « pas concerné »", () => {
    expect(matchesAudience(audienceOf({ situations: ['CENTRE_RESIDENT'] }), { situation: null })).toBeNull();
    expect(matchesAudience(audienceOf({ workTypes: ['SALARIE'] }), { travailleASenlis: null })).toBeNull();
    expect(matchesAudience(audienceOf({ situations: ['CENTRE_RESIDENT'] }), null)).toBeNull();
  });
});

describe("Public visé — à travers l'API", () => {
  async function createSurvey(token, audience) {
    const res = await request(app).post(API).set('Authorization', `Bearer ${token}`).send({
      title: 'Enquête ciblée', description: 'Une description suffisamment longue', status: 'OPEN', audience,
      questions: [{ label: 'Votre avis ?', type: 'OUI_NON' }],
    });
    expect(res.status).toBe(201);
    return res.body.survey;
  }

  it("enregistre les critères et les renvoie sous la forme d'un objet audience (détail et liste)", async () => {
    const { token } = await makeAdminUser();
    const survey = await createSurvey(token, { situations: ['AUTRE_QUARTIER'], quartiers: ['VILLEVERT'], workTypes: ['SALARIE'] });

    expect(survey.audience).toEqual({ situations: ['AUTRE_QUARTIER'], quartiers: ['VILLEVERT'], workQuartiers: [], workTypes: ['SALARIE'] });
    const list = await request(app).get(API);
    expect(list.body.items[0].audience.workTypes).toEqual(['SALARIE']);
    expect(list.body.items[0].audienceSituations).toBeUndefined(); // colonnes internes non exposées
  });

  it('sans public visé : tout le monde (listes vides)', async () => {
    const { token } = await makeAdminUser();
    const survey = await createSurvey(token, undefined);
    expect(Object.values(survey.audience).every((list) => list.length === 0)).toBe(true);
  });

  it('refuse des quartiers de résidence sans « habitants des autres quartiers »', async () => {
    const { token } = await makeAdminUser();
    const res = await request(app).post(API).set('Authorization', `Bearer ${token}`).send({
      title: 'Enquête ciblée', description: 'Une description suffisamment longue',
      audience: { situations: ['CENTRE_RESIDENT'], quartiers: ['VILLEVERT'] },
      questions: [{ label: 'Votre avis ?', type: 'OUI_NON' }],
    });
    expect(res.status).toBe(400);
  });

  it('le détail indique à la personne connectée si elle fait partie du public visé (sans l’empêcher de répondre)', async () => {
    const { token } = await makeAdminUser();
    const survey = await createSurvey(token, { situations: ['CENTRE_RESIDENT'] });

    const outside = await makeCitizen(); // makeCitizen : résident·e du centre par défaut
    await prisma.user.update({ where: { id: outside.user.id }, data: { situation: 'HORS_SENLIS' } });
    const res = await request(app).get(`${API}/${survey.slug}`).set('Authorization', `Bearer ${outside.token}`);
    expect(res.body.inAudience).toBe(false);

    const answer = await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${outside.token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionId: survey.questions[0].options[0].id }] });
    expect(answer.status).toBe(201);

    const anonymous = await request(app).get(`${API}/${survey.slug}`);
    expect(anonymous.body.inAudience).toBeNull();
  });

  it('les statistiques détaillées comptent les répondants dans et hors du public visé', async () => {
    const admin = await makeAdminUser();
    const survey = await createSurvey(admin.token, { situations: ['CENTRE_RESIDENT'] });
    const optionId = survey.questions[0].options[0].id;

    for (const situation of ['CENTRE_RESIDENT', 'CENTRE_RESIDENT', 'HORS_SENLIS', null]) {
      const c = await makeCitizen();
      await prisma.user.update({ where: { id: c.user.id }, data: { situation } });
      await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${c.token}`)
        .send({ answers: [{ questionId: survey.questions[0].id, optionId }] });
    }

    const res = await request(app).get(`${API}/${survey.id}/stats`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.audienceBreakdown).toEqual({ inAudience: 2, outOfAudience: 1, unknown: 1 });
    expect(res.body.audienceIsEveryone).toBe(false);
  });
});
