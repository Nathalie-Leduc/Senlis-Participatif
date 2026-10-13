// ══════════════════════════════════════════════════════════
// Tests — enquête stationnement v3 (S5R-06), v3.1 (S5R2-03)
//
// On crée l'enquête en base avec le MÊME service que le seed de
// production, puis on rejoue les parcours des trois tests de recette
// du 30/09 avec le moteur (lib/surveyFlow.js) : chaque persona doit
// voir exactement les questions de sa situation.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { createSurveySchema } from '../src/validators/surveys.js';
import { toNestedQuestionsCreate, resolveReferences } from '../src/services/surveyBuilder.js';
import { surveyPath, withConditionIds } from '../src/lib/surveyFlow.js';
import { PARKING_SURVEY } from '../prisma/surveys/stationnement-v3.js';

let questions; // questions en base, avec conditions et options

beforeEach(async () => {
  const surveyId = await prisma.$transaction(async (tx) => {
    const survey = await tx.survey.create({
      data: {
        slug: PARKING_SURVEY.slug, title: PARKING_SURVEY.title, description: PARKING_SURVEY.description,
        status: 'OPEN', questions: { create: toNestedQuestionsCreate(PARKING_SURVEY.questions) },
      },
    });
    await resolveReferences(tx, survey.id, PARKING_SURVEY.questions);
    return survey.id;
  });
  const rows = await prisma.question.findMany({
    where: { surveyId }, orderBy: { order: 'asc' },
    // S5R2-02 : les conditions des OPTIONS aussi (« Bus régional »)
    include: {
      options: { orderBy: { order: 'asc' }, include: { conditions: { select: { triggerOptionId: true } } } },
      conditions: { select: { optionId: true } },
    },
  });
  questions = rows.map(withConditionIds);
});

/**
 * Rejoue un parcours. `answers` : libellé de question → libellé(s)
 * d'option choisi(s). Renvoie les libellés des questions VUES.
 */
function pathOf(answers) {
  const chosen = (questionId) => {
    const q = questions.find((x) => x.id === questionId);
    const wanted = [answers[q.label]].flat().filter(Boolean);
    return q.options.filter((o) => wanted.some((w) => o.label.startsWith(w))).map((o) => o.id);
  };
  return surveyPath(questions, chosen);
}
function walk(answers) {
  return pathOf(answers).questionIds.map((id) => questions.find((q) => q.id === id).label);
}
/** S5R2-02 : libellés des options PROPOSÉES à une question, sur ce parcours */
function offered(answers, questionLabel) {
  const q = questions.find((x) => x.label === questionLabel);
  const ids = pathOf(answers).offeredOptions.get(q.id) ?? [];
  return q.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
}
const byLabel = (label) => questions.filter((q) => q.label === label);

describe('Enquête stationnement v3 / v3.1', () => {
  it("passe la même validation qu'une enquête créée dans l'administration", () => {
    const result = createSurveySchema.safeParse({
      title: PARKING_SURVEY.title, description: PARKING_SURVEY.description, questions: PARKING_SURVEY.questions,
    });
    expect(result.success, JSON.stringify(result.error?.issues?.slice(0, 3))).toBe(true);
  });

  it('test 1 — résident·e du centre, ne travaille pas, sans véhicule : 3 questions, puis fin', () => {
    const seen = walk({
      'Où résidez-vous ?': 'Le Centre historique',
      'Travaillez-vous ou dirigez-vous une activité à Senlis ?': 'Non',
      'Votre foyer possède-t-il une ou plusieurs voitures ou motos ?': 'Non',
    });
    expect(seen).toEqual([
      'Où résidez-vous ?',
      'Travaillez-vous ou dirigez-vous une activité à Senlis ?',
      'Votre foyer possède-t-il une ou plusieurs voitures ou motos ?',
    ]);
  });

  it('test 1 bis — avec véhicules : stationnement obligatoire et limité au nombre de véhicules, motifs de circulation', () => {
    const seen = walk({
      'Où résidez-vous ?': 'Le Centre historique',
      'Travaillez-vous ou dirigez-vous une activité à Senlis ?': 'Non',
      'Votre foyer possède-t-il une ou plusieurs voitures ou motos ?': 'Oui',
      'Vous arrive-t-il de circuler en voiture dans le centre historique ?': 'Oui',
      'Pour quelle(s) raison(s) ?': 'Autre motif',
    });
    expect(seen).toContain('Où sont garées vos voitures ou motos ?');
    expect(seen).toContain('Lequel ?');
    expect(seen).toContain('À quelle fréquence circulez-vous en voiture dans le centre historique ?');
    // Plus jamais l'ancienne question des habitants
    expect(seen).not.toContain('Utilisez-vous une voiture pour vos déplacements dans ou vers le centre historique ?');

    const [parking] = byLabel('Où sont garées vos voitures ou motos ?');
    const [count] = byLabel('Combien de voitures ou motos compte votre foyer ?');
    expect(parking.required).toBe(true);
    expect(parking.maxChoicesFromId).toBe(count.id);
    expect(parking.options.map((o) => o.label)).not.toContain("Je n'ai pas de véhicule");
  });

  it('test 2 — résident·e du centre qui dirige une activité dans le centre : « Laquelle ? », véhicules pro (≥ 1)', () => {
    const seen = walk({
      'Où résidez-vous ?': 'Le Centre historique',
      'Travaillez-vous ou dirigez-vous une activité à Senlis ?': 'Oui',
      'Dans quel quartier travaillez-vous ?': 'Centre historique',
      'À ce titre…': 'Je dirige',
      "Quel type d'activité (la vôtre, ou celle qui vous emploie) ?": 'Autre activité',
      'Comment venez-vous travailler le plus souvent ?': 'À pied',
      'Utilisez-vous un ou plusieurs véhicules à des fins professionnelles (livraisons, tournées…) ?': 'Oui',
      'Votre foyer possède-t-il une ou plusieurs voitures ou motos ?': 'Non',
    });
    expect(seen).toContain('Laquelle ?');
    expect(seen).toContain('Où sont garés ces véhicules professionnels ?');
    expect(seen).not.toContain('En dehors de votre éventuel travail, à quelle fréquence venez-vous dans le centre historique ?');

    const [nbPro] = byLabel('Combien de véhicules professionnels ?');
    expect(nbPro.minValue).toBe(1);
    const [parkingPro] = byLabel('Où sont garés ces véhicules professionnels ?');
    expect(parkingPro.required).toBe(true);
    expect(parkingPro.maxChoicesFromId).toBe(nbPro.id);
  });

  it("test 3 — autre quartier, salarié·e d'un autre quartier, vient en voiture dans le centre : bloc « visite », pas le bloc « travail »", () => {
    const seen = walk({
      'Où résidez-vous ?': 'Un autre quartier',
      'Travaillez-vous ou dirigez-vous une activité à Senlis ?': 'Oui',
      'Dans quel quartier travaillez-vous ?': 'Brichebay',
      "Quel type d'activité (la vôtre, ou celle qui vous emploie) ?": 'Commerces et boutiques',
      'En dehors de votre éventuel travail, à quelle fréquence venez-vous dans le centre historique ?': 'Occasionnellement',
      'Le plus souvent, comment venez-vous dans le centre historique ?': 'Voiture',
      'Quels freins vous empêchent de venir sans voiture ?': 'Autre frein',
    });
    expect(seen).not.toContain('Comment venez-vous travailler le plus souvent ?');
    expect(seen).not.toContain('Où garez-vous ce véhicule pendant votre travail ?');
    expect(seen).toContain('Où vous garez-vous le plus souvent ?');
    expect(seen).toContain('Précisez cet autre frein');
    expect(seen).not.toContain('Votre foyer possède-t-il une ou plusieurs voitures ou motos ?');
    expect(seen.at(-1)).toMatch(/Une suggestion/);
  });

  it('les questions clés de la recette restent obligatoires ; « Laquelle ? » (activité) devient facultative (v3.1)', () => {
    const optional = questions.filter((q) => !q.required).map((q) => q.label);
    expect(optional).toEqual([
      'Laquelle ?',
      'Une suggestion pour le stationnement ou les déplacements dans le centre historique ?',
    ]);
  });
});

// ── Version 3.1 (S5R2-03, recette du 08/10) ───────────────
describe('Enquête stationnement v3.1', () => {
  const VENIR_CENTRE = 'Le plus souvent, comment venez-vous dans le centre historique ?';
  const VENIR_TRAVAIL = 'Comment venez-vous travailler le plus souvent ?';

  it('« Bus régional » proposé seulement aux résident·es d’une autre ville', () => {
    const visite = (residence) => ({
      'Où résidez-vous ?': residence,
      'Travaillez-vous ou dirigez-vous une activité à Senlis ?': 'Non',
      'En dehors de votre éventuel travail, à quelle fréquence venez-vous dans le centre historique ?': 'Occasionnellement',
    });
    expect(offered(visite('Une autre ville'), VENIR_CENTRE)).toContain('Bus régional');
    expect(offered(visite('Un autre quartier'), VENIR_CENTRE)).not.toContain('Bus régional');
    expect(offered(visite('Un autre quartier'), VENIR_CENTRE)).toContain('TUS (bus gratuit de Senlis)');

    // Même règle dans le bloc « travail » (habite ailleurs, travaille au centre)
    const travail = (residence) => ({
      'Où résidez-vous ?': residence,
      'Travaillez-vous ou dirigez-vous une activité à Senlis ?': 'Oui',
      'Dans quel quartier travaillez-vous ?': 'Centre historique',
    });
    expect(offered(travail('Une autre ville'), VENIR_TRAVAIL)).toContain('Bus régional');
    expect(offered(travail('Le Centre historique'), VENIR_TRAVAIL)).not.toContain('Bus régional');
  });

  it('Saint-Vincent est un « autre quartier » : proposé, synchronisé, et hors du bloc « Centre historique »', () => {
    const [quartier] = byLabel('Dans quel quartier ?');
    expect(quartier.options[0]).toMatchObject({ label: 'Quartier Saint-Vincent', syncValue: 'SAINT_VINCENT' });
    const [residence] = byLabel('Où résidez-vous ?');
    expect(residence.options.map((o) => o.label)).toEqual([
      'Le Centre historique', 'Un autre quartier de Senlis (dont Saint-Vincent)', 'Une autre ville',
    ]);

    // Habite et travaille à Saint-Vincent : bloc « venir dans le centre », jamais « travail au centre » ni « résident du centre »
    const seen = walk({
      'Où résidez-vous ?': 'Un autre quartier',
      'Dans quel quartier ?': 'Quartier Saint-Vincent',
      'Travaillez-vous ou dirigez-vous une activité à Senlis ?': 'Oui',
      'Dans quel quartier travaillez-vous ?': 'Quartier Saint-Vincent',
    });
    expect(seen).toContain('En dehors de votre éventuel travail, à quelle fréquence venez-vous dans le centre historique ?');
    expect(seen).not.toContain(VENIR_TRAVAIL);
    expect(seen).not.toContain('Votre foyer possède-t-il une ou plusieurs voitures ou motos ?');
  });

  it('activités en 6 familles + « Autre activité », exemples en aide', () => {
    const [activite] = byLabel("Quel type d'activité (la vôtre, ou celle qui vous emploie) ?");
    expect(activite.options.map((o) => o.label)).toEqual([
      'Commerces et boutiques', 'Services de proximité, agences et santé', 'Cafés, hôtels et restaurants',
      'Administrations et services publics', 'Enseignement, culture et social', 'Bureaux et secteur tertiaire',
      'Autre activité',
    ]);
    expect(activite.helpText).toMatch(/^Exemples/);
    // L'invitation à transmettre aux salarié·es n'est pas perdue
    expect(byLabel('À ce titre…')[0].helpText).toMatch(/salarié·es/);
  });

  it('plus de « véhicules motorisés » : « voitures ou motos »', () => {
    expect(questions.some((q) => /motoris/.test(q.label))).toBe(false);
  });
});
