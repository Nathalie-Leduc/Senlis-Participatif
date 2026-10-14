// ══════════════════════════════════════════════════════════
// Tests — répondants de démonstration (npm run seed:demo, 14/10)
//
// Le script fait répondre 20 profils fictifs à l'enquête stationnement
// v3.1 en passant par la VRAIE route de l'API : on vérifie ici que
// toutes les réponses sont acceptées, que chacun répond aux questions
// de profil selon SA fiche, et que les profils couvrent tous les cas.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { signToken } from '../src/lib/jwt.js';
import { toNestedQuestionsCreate, resolveReferences } from '../src/services/surveyBuilder.js';
import { PARKING_SURVEY } from '../prisma/surveys/stationnement-v3.js';
import { PERSONAS, fillSurvey, profileValues, DEMO_DOMAIN } from '../prisma/seed-demo.js';

async function createParkingSurvey() {
  return prisma.$transaction(async (tx) => {
    const survey = await tx.survey.create({
      data: {
        slug: PARKING_SURVEY.slug, title: PARKING_SURVEY.title, description: PARKING_SURVEY.description,
        status: 'OPEN', questions: { create: toNestedQuestionsCreate(PARKING_SURVEY.questions) },
      },
    });
    await resolveReferences(tx, survey.id, PARKING_SURVEY.questions);
    return survey;
  });
}

describe('Profils de démonstration', () => {
  it('20 profils qui couvrent les 3 résidences, chaque autre quartier, et le travail', () => {
    expect(PERSONAS).toHaveLength(20);
    expect(new Set(PERSONAS.map((p) => p.situation))).toEqual(new Set(['CENTRE_RESIDENT', 'AUTRE_QUARTIER', 'HORS_SENLIS']));
    const quartiers = new Set(PERSONAS.map((p) => p.quartier).filter(Boolean));
    for (const q of ['SAINT_VINCENT', 'BRICHEBAY', 'BON_SECOURS', 'VAL_AUNETTE_GATELIERE', 'VILLEVERT', 'JARDINIERS', 'ZONE_INDUSTRIELLE']) {
      expect(quartiers).toContain(q);
    }
    expect(PERSONAS.some((p) => !p.travail)).toBe(true);
    expect(new Set(PERSONAS.filter((p) => p.travail).map((p) => p.travail.type))).toEqual(new Set(['COMMERCANT', 'SALARIE']));
    // Un quartier n'est donné qu'aux résident·es d'un autre quartier, une ville qu'aux autres villes
    for (const p of PERSONAS) {
      expect(Boolean(p.quartier)).toBe(p.situation === 'AUTRE_QUARTIER');
      expect(Boolean(p.ville)).toBe(p.situation === 'HORS_SENLIS');
    }
  });
});

describe('fillSurvey — enquête stationnement v3.1', () => {
  it('les 20 réponses passent la vraie validation de l’API, et le profil synchronisé correspond à la fiche', async () => {
    const created = await createParkingSurvey();
    const { body } = await request(app).get(`/api/v1/surveys/${created.slug}`);

    for (const persona of PERSONAS) {
      const user = await prisma.user.create({
        data: {
          email: `${persona.prenom.toLowerCase()}-${Date.now()}@${DEMO_DOMAIN}`,
          pseudo: `Demo-${persona.prenom}-${Math.random().toString(36).slice(2, 6)}`,
          passwordHash: 'x', emailVerified: true,
        },
      });
      const res = await request(app)
        .post(`/api/v1/surveys/${created.id}/responses`)
        .set('Authorization', `Bearer ${signToken(user)}`)
        .send({ answers: fillSurvey(body.survey, persona) });
      expect(res.status, `${persona.prenom} : ${JSON.stringify(res.body.error)}`).toBe(201);

      // La synchronisation a rempli le profil d'après les réponses :
      // il doit être exactement celui de la fiche
      const synced = await prisma.user.findUnique({ where: { id: user.id } });
      const expected = profileValues(persona);
      expect(synced.situation).toBe(expected.situation);
      expect(synced.quartier).toBe(expected.quartier);
      expect(synced.travailleASenlis).toBe(expected.travailleASenlis === 'true');
      expect(synced.travailleQuartier).toBe(expected.travailleQuartier);
    }
    expect(await prisma.surveyResponse.count({ where: { surveyId: created.id } })).toBe(20);
  }, 30000);

  it('« au hasard » mais reproductible : mêmes réponses à chaque lancement', async () => {
    const created = await createParkingSurvey();
    const { body } = await request(app).get(`/api/v1/surveys/${created.slug}`);
    expect(fillSurvey(body.survey, PERSONAS[4])).toEqual(fillSurvey(body.survey, PERSONAS[4]));
  });
});

describe('Limiteur général et seed de démonstration (429 du 14/10)', () => {
  it('l’interrupteur est baissé par défaut : le serveur reste protégé', () => {
    // Importer le script (comme ici) ne le lève pas : seul main() le fait
    expect(app.locals.bypassRateLimit).toBeUndefined();
  });
});
