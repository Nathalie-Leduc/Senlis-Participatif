// Mêmes scénarios que api/tests/survey-engine-v2.test.js : les deux
// moteurs (navigateur et API) doivent répondre exactement pareil.
import { describe, it, expect } from 'vitest';
import { visibleQuestionIds, chosenFromAnswers } from './surveyFlow.js';

const questions = [
  { id: 'q0', order: 0, conditionOptionIds: [], options: [{ id: 'centre' }, { id: 'ailleurs' }] },
  { id: 'q1', order: 1, conditionOptionIds: [], options: [{ id: 'voiture' }, { id: 'velo' }] },
  { id: 'q2', order: 2, conditionOptionIds: ['centre', 'voiture'], options: [{ id: 'zero', endsSurvey: true }, { id: 'un' }] },
  { id: 'q3', order: 3, conditionOptionIds: [] },
];
const run = (answers) => visibleQuestionIds(questions, (id) => answers[id] ?? []);

describe('visibleQuestionIds (navigateur)', () => {
  it("OU : affichée si l'UNE des conditions est remplie", () => {
    expect(run({ q0: ['ailleurs'], q1: ['voiture'] })).toEqual(['q0', 'q1', 'q2', 'q3']);
    expect(run({ q0: ['centre'], q1: ['velo'] })).toEqual(['q0', 'q1', 'q2', 'q3']);
    expect(run({ q0: ['ailleurs'], q1: ['velo'] })).toEqual(['q0', 'q1', 'q3']);
  });

  it('fin anticipée', () => {
    expect(run({ q0: ['centre'], q1: ['velo'], q2: ['zero'] })).toEqual(['q0', 'q1', 'q2']);
  });

  it("une réponse à une question CACHÉE ne déclenche rien", () => {
    const qs = [
      { id: 'a', order: 0, conditionOptionIds: [], options: [{ id: 'oui' }, { id: 'non' }] },
      { id: 'b', order: 1, conditionOptionIds: ['oui'], options: [{ id: 'x' }] },
      { id: 'c', order: 2, conditionOptionIds: ['x'] },
    ];
    // « non » cache b ; une réponse « x » restée en mémoire ne doit pas afficher c
    expect(visibleQuestionIds(qs, (id) => ({ a: ['non'], b: ['x'] }[id] ?? []))).toEqual(['a']);
  });

  it('chosenFromAnswers lit choix unique et choix multiple', () => {
    const chosen = chosenFromAnswers({ a: { optionId: 'o1' }, b: { optionIds: ['o2', 'o3'] }, c: { valueNumber: 2 } });
    expect(chosen('a')).toEqual(['o1']);
    expect(chosen('b')).toEqual(['o2', 'o3']);
    expect(chosen('c')).toEqual([]);
  });
});
