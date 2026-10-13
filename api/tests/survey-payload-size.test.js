// ══════════════════════════════════════════════════════════
// Tests — taille des envois d'enquête (correctif du 13/10)
//
// Recette : « Requête trop volumineuse » en clôturant l'enquête
// stationnement — le formulaire renvoie le questionnaire COMPLET
// (~12 ko pour 39 questions), au-delà des 10 ko acceptés partout.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { makeAdminUser } from './helpers.js';
import { PARKING_SURVEY } from '../prisma/surveys/stationnement-v3.js';

const as = (token) => ({ Authorization: `Bearer ${token}` });

describe('Enquête de plus de 10 ko', () => {
  it('la vraie enquête stationnement se crée, puis se clôture en renvoyant tout le questionnaire', async () => {
    const body = { title: PARKING_SURVEY.title, description: PARKING_SURVEY.description, questions: PARKING_SURVEY.questions };
    expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(10 * 1024);

    const { token } = await makeAdminUser();
    const created = await request(app).post('/api/v1/surveys').set(as(token)).send({ ...body, status: 'OPEN' });
    expect(created.status).toBe(201);

    // Exactement ce que fait le formulaire : tout renvoyer, statut changé
    const closed = await request(app).patch(`/api/v1/surveys/${created.body.survey.id}`).set(as(token))
      .send({ ...body, status: 'CLOSED' });
    expect(closed.status).toBe(200);
    expect(closed.body.survey.status).toBe('CLOSED');
  });

  it('ailleurs, la limite de 10 ko protège toujours (ex. une proposition)', async () => {
    const { token } = await makeAdminUser();
    const res = await request(app).post('/api/v1/proposals').set(as(token)).send({
      title: 'Titre correct', summary: 'Une accroche correcte', content: 'x'.repeat(20 * 1024),
    });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.message).toMatch(/Trop de contenu/);
  });
});
