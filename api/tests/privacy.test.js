// ══════════════════════════════════════════════════════════
// Tests unitaires — confidentialité statistique (S5-21)
//
// Fonctions PURES : aucune requête HTTP, aucune écriture en base.
// (setup.js vide quand même la base avant chaque test, comme pour
// tous les fichiers — sans conséquence ici.)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { MIN_GROUP_SIZE, isTooSmall, maskSmallQuestions } from '../src/lib/privacy.js';

describe('isTooSmall — seuil de confidentialité', () => {
  it('le seuil est de 5 personnes', () => {
    expect(MIN_GROUP_SIZE).toBe(5);
  });

  it("un groupe vide n'est pas masqué (il ne révèle l'opinion de personne)", () => {
    expect(isTooSmall(0)).toBe(false);
  });

  it('un groupe de 1 à 4 personnes est masqué', () => {
    for (const n of [1, 2, 3, 4]) expect(isTooSmall(n)).toBe(true);
  });

  it('un groupe de 5 personnes ou plus est affiché', () => {
    expect(isTooSmall(5)).toBe(false);
    expect(isTooSmall(120)).toBe(false);
  });

  it('accepte un seuil personnalisé', () => {
    expect(isTooSmall(9, 10)).toBe(true);
    expect(isTooSmall(10, 10)).toBe(false);
  });
});

describe('maskSmallQuestions', () => {
  const questions = [
    { id: 'q1', label: 'Vue par 12', type: 'OUI_NON', showIfOptionId: null, totalForQuestion: 12, options: [{ id: 'o1', count: 12 }] },
    { id: 'q2', label: 'Vue par 2', type: 'NOMBRE', showIfOptionId: 'o1', totalForQuestion: 2, stats: { count: 2, average: 3 } },
    { id: 'q3', label: 'Vue par personne', type: 'NOMBRE', showIfOptionId: 'o9', totalForQuestion: 0, stats: { count: 0 } },
  ];

  it('garde intactes les questions assez grandes (ou vides), marquées masked: false', () => {
    const [q1, , q3] = maskSmallQuestions(questions);
    expect(q1).toMatchObject({ masked: false, totalForQuestion: 12, options: [{ id: 'o1', count: 12 }] });
    expect(q3).toMatchObject({ masked: false, totalForQuestion: 0 });
  });

  it('retire comptes, statistiques et effectif exact des questions trop petites', () => {
    const q2 = maskSmallQuestions(questions)[1];
    expect(q2).toEqual({
      id: 'q2', label: 'Vue par 2', type: 'NOMBRE', showIfOptionId: 'o1',
      totalForQuestion: null, masked: true,
    });
    expect(q2.stats).toBeUndefined();
  });

  it('ne modifie pas le tableau reçu (fonction pure)', () => {
    maskSmallQuestions(questions);
    expect(questions[1].stats).toEqual({ count: 2, average: 3 });
    expect(questions[1].masked).toBeUndefined();
  });
});
