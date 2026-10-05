import { describe, it, expect } from 'vitest';
import { toCsv, toJson } from './resultsExport.js';

const results = { survey: { title: 'Stationnement' }, totalResponses: 12, minGroupSize: 5 };
const questions = [
  { id: 'a', label: 'Satisfait·e ?', type: 'OUI_NON', totalForQuestion: 12,
    options: [{ label: 'Oui', count: 9, percentage: 75 }, { label: 'Non', count: 3, percentage: 25 }] },
  { id: 'b', label: 'Un commentaire ; libre', type: 'TEXTE_LIBRE', totalForQuestion: 12, totalAnswered: 4, answers: ['Je suis Jean, du 3 rue X'] },
  { id: 'c', label: 'Question rare', type: 'NOMBRE', masked: true, totalForQuestion: null },
];

describe('export des résultats', () => {
  it('CSV pour Excel : BOM, séparateur « ; », cellules échappées', () => {
    const csv = toCsv(results, questions, 'tout le monde');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Satisfait·e ?;Oui / Non;12;Oui;9;75 %');
    expect(csv).toContain('"Un commentaire ; libre"');
  });

  it('ni le texte libre brut, ni le contenu d’une question masquée ne sortent dans le fichier', () => {
    const csv = toCsv(results, questions, 'tout le monde');
    const json = JSON.stringify(toJson(results, questions, 'tout le monde'));
    for (const output of [csv, json]) expect(output).not.toContain('Jean');
    expect(csv).toContain('Question rare;Nombre;masqué (moins de 5)');
    expect(toJson(results, questions, 'x').questions[2]).toEqual({ question: 'Question rare', type: 'NOMBRE', masque: true });
  });
});
