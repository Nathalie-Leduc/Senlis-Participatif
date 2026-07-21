// ══════════════════════════════════════════════════════════
// Tests d'intégration — Moteur d'enquête (Sprint 4, S4-06)
//
// Même esprit que tests/votes-invariants.test.js : on ne teste pas
// juste "est-ce que ça marche", mais "est-ce que les RÈGLES qui ne
// doivent JAMAIS être violées tiennent, même sous concurrence
// réelle" — transaction tout-ou-rien, double réponse, agrégats.
//
// Une deuxième partie couvre le CRUD (S4-01) et la génération
// automatique des options OUI_NON, qui n'avaient encore aucun test
// dédié jusqu'ici.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeCitizen, makeAdminUser, seedSurvey } from './helpers.js';

const API = '/api/v1/surveys';

describe('Enquêtes — soumission de réponse', () => {
  it('401 sans authentification', async () => {
    const survey = await seedSurvey();
    const res = await request(app).post(`${API}/${survey.id}/responses`).send({ answers: [] });
    expect(res.status).toBe(401);
  });

  it("403 SURVEY_CLOSED — une enquête en DRAFT ne peut pas recevoir de réponse", async () => {
    const draft = await seedSurvey({ status: 'DRAFT' });
    const { token } = await makeCitizen();
    const oui = draft.questions[0].options[0];

    const res = await request(app)
      .post(`${API}/${draft.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: draft.questions[0].id, optionId: oui.id }] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SURVEY_CLOSED');
  });

  it('403 SURVEY_CLOSED — une enquête CLOSED ne peut plus recevoir de réponse', async () => {
    const closed = await seedSurvey({ status: 'CLOSED' });
    const { token } = await makeCitizen();
    const oui = closed.questions[0].options[0];

    const res = await request(app)
      .post(`${API}/${closed.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: closed.questions[0].id, optionId: oui.id }] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SURVEY_CLOSED');
  });

  it('400 — une question obligatoire restée sans réponse est refusée', async () => {
    // seedSurvey() : question 0 (OUI_NON) required=true, question 1
    // (NOMBRE) required=false — on ne répond à AUCUNE des deux.
    const survey = await seedSurvey();
    const { token } = await makeCitizen();

    const res = await request(app)
      .post(`${API}/${survey.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [] });

    expect(res.status).toBe(400);
  });

  it("400 — une option qui n'appartient pas à la question est refusée", async () => {
    const survey = await seedSurvey();
    const { token } = await makeCitizen();

    // On prend une option qui existe bien en base, mais rattachée à
    // une AUTRE question — donc invalide pour question 0.
    const autreEnquete = await seedSurvey();
    const optionEtrangere = autreEnquete.questions[0].options[0];

    const res = await request(app)
      .post(`${API}/${survey.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionId: optionEtrangere.id }] });

    expect(res.status).toBe(400);
  });

  it('201 — une soumission valide crée le bulletin ET ses réponses', async () => {
    const survey = await seedSurvey();
    const { token, user } = await makeCitizen();
    const oui = survey.questions[0].options.find((o) => o.label === 'Oui');

    const res = await request(app)
      .post(`${API}/${survey.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [
          { questionId: survey.questions[0].id, optionId: oui.id },
          { questionId: survey.questions[1].id, valueNumber: 3 },
        ],
      });

    expect(res.status).toBe(201);

    const stored = await prisma.surveyResponse.findUnique({
      where: { userId_surveyId: { userId: user.id, surveyId: survey.id } },
      include: { answers: true },
    });
    expect(stored).not.toBeNull();
    expect(stored.answers).toHaveLength(2);
  });

  it('409 ALREADY_RESPONDED — une deuxième soumission séquentielle est refusée', async () => {
    const survey = await seedSurvey();
    const { token } = await makeCitizen();
    const oui = survey.questions[0].options.find((o) => o.label === 'Oui');
    const payload = { answers: [{ questionId: survey.questions[0].id, optionId: oui.id }] };

    const first = await request(app)
      .post(`${API}/${survey.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`${API}/${survey.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_RESPONDED');

    const count = await prisma.surveyResponse.count({ where: { surveyId: survey.id } });
    expect(count).toBe(1);
  });

  // ── Invariant : transaction tout-ou-rien, sous concurrence réelle ──
  //
  // Même principe que le test équivalent pour le vote : Promise.all
  // envoie les deux requêtes EN PARALLÈLE, pour simuler un vrai
  // double clic ou deux onglets ouverts sur la même page.
  it(
    'deux soumissions envoyées EN MÊME TEMPS par le même citoyen ne produisent qu\'un seul bulletin en base',
    async () => {
      const survey = await seedSurvey();
      const { token } = await makeCitizen();
      const oui = survey.questions[0].options.find((o) => o.label === 'Oui');
      const payload = { answers: [{ questionId: survey.questions[0].id, optionId: oui.id }] };

      const [resA, resB] = await Promise.all([
        request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${token}`).send(payload),
        request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${token}`).send(payload),
      ]);

      // Aucune des deux ne doit planter (pas de 500) : une passe
      // (201), l'autre est absorbée proprement par la contrainte
      // unique (409) — jamais les deux à 201.
      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      // La vraie preuve est en base, pas dans la réponse HTTP.
      const responseCount = await prisma.surveyResponse.count({ where: { surveyId: survey.id } });
      expect(responseCount).toBe(1);

      // Et le bulletin qui A été créé doit être COMPLET (son Answer
      // associé), pas une coquille vide — la transaction n'a pas pu
      // s'arrêter à mi-chemin.
      const answerCount = await prisma.answer.count({ where: { response: { surveyId: survey.id } } });
      expect(answerCount).toBe(1);
    },
    10000, // deux vraies requêtes HTTP en parallèle : un peu plus lent que la moyenne
  );

  it('CHOIX_MULTIPLE — cocher deux fois la même option ne crée qu\'une seule ligne Answer', async () => {
    const survey = await seedSurvey({
      questions: {
        create: [
          {
            label: 'Quels services utilisez-vous régulièrement ?',
            type: 'CHOIX_MULTIPLE',
            required: true,
            order: 0,
            options: { create: [{ label: 'Bus', order: 0 }, { label: 'Vélo en libre-service', order: 1 }] },
          },
        ],
      },
    });
    const { token } = await makeCitizen();
    const bus = survey.questions[0].options[0];

    const res = await request(app)
      .post(`${API}/${survey.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionIds: [bus.id, bus.id] }] });

    expect(res.status).toBe(201);

    const answers = await prisma.answer.findMany({ where: { questionId: survey.questions[0].id } });
    expect(answers).toHaveLength(1);
  });
});

describe('Enquêtes — agrégats (résultats)', () => {
  it('les résultats reflètent fidèlement plusieurs réponses réelles', async () => {
    const survey = await seedSurvey();
    const oui = survey.questions[0].options.find((o) => o.label === 'Oui');
    const non = survey.questions[0].options.find((o) => o.label === 'Non');

    const alice = await makeCitizen();
    const bruno = await makeCitizen();
    const claire = await makeCitizen();

    // Séquentiel, PAS Promise.all : chaque inscription doit être
    // terminée avant la suivante — même raison que dans
    // proposals.test.js (buildUser() partage un compteur global).
    await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${alice.token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionId: oui.id }, { questionId: survey.questions[1].id, valueNumber: 2 }] });
    await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${bruno.token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionId: oui.id }, { questionId: survey.questions[1].id, valueNumber: 4 }] });
    // Claire répond OUI/NON mais laisse la question NOMBRE (optionnelle) de côté.
    await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${claire.token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionId: non.id }] });

    const res = await request(app).get(`${API}/${survey.slug}/results`);
    expect(res.status).toBe(200);
    expect(res.body.totalResponses).toBe(3);

    const q0 = res.body.questions.find((q) => q.id === survey.questions[0].id);
    expect(q0.options.find((o) => o.id === oui.id).count).toBe(2);
    expect(q0.options.find((o) => o.id === non.id).count).toBe(1);
    // Pourcentage calculé sur totalResponses (3), pas sur les seuls
    // répondants à CETTE question — voir le commentaire du contrôleur.
    expect(q0.options.find((o) => o.id === oui.id).percentage).toBeCloseTo(66.7, 1);

    const q1 = res.body.questions.find((q) => q.id === survey.questions[1].id);
    expect(q1.stats.count).toBe(2); // seules alice et bruno ont répondu
    expect(q1.stats.average).toBe(3); // (2 + 4) / 2
    expect(q1.stats.min).toBe(2);
    expect(q1.stats.max).toBe(4);
  }, 10000);

  it("une option jamais choisie apparaît quand même à 0, pas absente du résultat", async () => {
    const survey = await seedSurvey();
    const { token } = await makeCitizen();
    const oui = survey.questions[0].options.find((o) => o.label === 'Oui');

    await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionId: oui.id }] });

    const res = await request(app).get(`${API}/${survey.slug}/results`);
    const q0 = res.body.questions.find((q) => q.id === survey.questions[0].id);
    const nonResult = q0.options.find((o) => o.label === 'Non');

    expect(nonResult).toBeDefined();
    expect(nonResult.count).toBe(0);
  });
});

describe('Enquêtes — CRUD admin & consultation', () => {
  it('un admin crée une enquête avec questions et options imbriquées en un seul appel', async () => {
    const { token } = await makeAdminUser();

    const res = await request(app)
      .post(API)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Enquête créée par un test',
        description: 'Une description suffisamment longue pour passer la validation Zod.',
        questions: [
          { label: 'Une question à choix unique', type: 'CHOIX_UNIQUE', options: [{ label: 'A' }, { label: 'B' }] },
          { label: 'Une question libre, non obligatoire', type: 'TEXTE_LIBRE', required: false },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.survey.questions).toHaveLength(2);
    expect(res.body.survey.questions[0].options).toHaveLength(2);
  });

  it('OUI_NON sans options fournies génère "Oui"/"Non" par défaut', async () => {
    const { token } = await makeAdminUser();

    const res = await request(app)
      .post(API)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Enquête OUI_NON par défaut',
        description: 'Description suffisamment longue pour la validation.',
        questions: [{ label: 'Êtes-vous satisfait de ce service municipal ?', type: 'OUI_NON' }],
      });

    expect(res.status).toBe(201);
    const options = res.body.survey.questions[0].options.map((o) => o.label);
    expect(options).toEqual(['Oui', 'Non']);
  });

  it('refuse une question CHOIX_UNIQUE avec moins de 2 options', async () => {
    const { token } = await makeAdminUser();

    const res = await request(app)
      .post(API)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Enquête invalide',
        description: 'Description suffisamment longue pour la validation.',
        questions: [{ label: 'Question à choix unique', type: 'CHOIX_UNIQUE', options: [{ label: 'Une seule option' }] }],
      });

    expect(res.status).toBe(400);
  });

  it('la liste publique ne renvoie jamais les enquêtes DRAFT', async () => {
    await seedSurvey({ slug: 'brouillon-cache', title: 'Brouillon caché', status: 'DRAFT' });
    await seedSurvey({ slug: 'ouverte-visible', title: 'Ouverte visible', status: 'OPEN' });

    const res = await request(app).get(API);
    const titles = res.body.items.map((s) => s.title);

    expect(titles).not.toContain('Brouillon caché');
    expect(titles).toContain('Ouverte visible');
  });

  it("un admin peut consulter le détail d'une enquête DRAFT, pas un citoyen", async () => {
    const draft = await seedSurvey({ status: 'DRAFT' });
    const { token: adminToken } = await makeAdminUser();
    const { token: citizenToken } = await makeCitizen();

    const asAdmin = await request(app).get(`${API}/${draft.slug}`).set('Authorization', `Bearer ${adminToken}`);
    expect(asAdmin.status).toBe(200);

    const asCitizen = await request(app).get(`${API}/${draft.slug}`).set('Authorization', `Bearer ${citizenToken}`);
    expect(asCitizen.status).toBe(404);
  });

  it("409 SURVEY_HAS_RESPONSES en tentant de modifier les questions d'une enquête déjà répondue", async () => {
    const survey = await seedSurvey();
    const { token: citizenToken } = await makeCitizen();
    const oui = survey.questions[0].options.find((o) => o.label === 'Oui');

    await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${citizenToken}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionId: oui.id }] });

    const { token: adminToken } = await makeAdminUser();
    const res = await request(app)
      .patch(`${API}/${survey.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questions: [{ label: 'Nouvelle question qui remplacerait tout', type: 'TEXTE_LIBRE' }] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SURVEY_HAS_RESPONSES');
  });

  it('409 SURVEY_HAS_RESPONSES en tentant de supprimer une enquête déjà répondue', async () => {
    const survey = await seedSurvey();
    const { token: citizenToken } = await makeCitizen();
    const oui = survey.questions[0].options.find((o) => o.label === 'Oui');

    await request(app).post(`${API}/${survey.id}/responses`).set('Authorization', `Bearer ${citizenToken}`)
      .send({ answers: [{ questionId: survey.questions[0].id, optionId: oui.id }] });

    const { token: adminToken } = await makeAdminUser();
    const res = await request(app).delete(`${API}/${survey.id}`).set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SURVEY_HAS_RESPONSES');

    const stillThere = await prisma.survey.findUnique({ where: { id: survey.id } });
    expect(stillThere).not.toBeNull();
  });
});
