// Mêmes scénarios que api/tests/survey-engine-v2.test.js : les deux
// moteurs (navigateur et API) doivent répondre exactement pareil.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { visibleQuestionIds, chosenFromAnswers, surveyPath } from './surveyFlow.js';

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

// ── S5R2-02 : options conditionnelles (mêmes scénarios que
// api/tests/option-conditions.test.js) ──
describe('Options proposées (navigateur)', () => {
  const withOptions = [
    { id: 'q0', order: 0, options: [{ id: 'senlis' }, { id: 'ailleurs' }] },
    { id: 'q1', order: 1, options: [{ id: 'pied' }, { id: 'bus', conditionOptionIds: ['ailleurs'] }] },
    { id: 'q2', order: 2, conditionOptionIds: ['bus'] },
    { id: 'q3', order: 3, options: [{ id: 'abo', conditionOptionIds: ['ailleurs'] }] },
  ];
  const path2 = (answers) => surveyPath(withOptions, (id) => answers[id] ?? []);

  it('« Bus régional » n’est proposé qu’à qui réside ailleurs', () => {
    expect(path2({ q0: ['senlis'] }).offeredOptions.get('q1')).toEqual(['pied']);
    expect(path2({ q0: ['ailleurs'] }).offeredOptions.get('q1')).toEqual(['pied', 'bus']);
  });

  it('un choix non proposé ne déclenche rien ; une question sans option proposée est sautée', () => {
    expect(path2({ q0: ['senlis'], q1: ['bus'] }).questionIds).toEqual(['q0', 'q1']);
    expect(path2({ q0: ['ailleurs'], q1: ['bus'] }).questionIds).toEqual(['q0', 'q1', 'q2', 'q3']);
  });
});

// ── Garde-fou : les deux copies du moteur sont IDENTIQUES ──
// Le bloc entre les repères « MOTEUR — début / fin » doit être le même,
// caractère pour caractère, ici et dans l'API. Analogie : deux horloges
// qui doivent sonner à la même seconde — on les compare, on ne suppose pas.
describe('Copie conforme API / navigateur', () => {
  const engineBlock = (file) => {
    const code = readFileSync(file, 'utf8');
    const start = code.indexOf('// ── MOTEUR — début');
    const end = code.indexOf('// ── MOTEUR — fin');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return code.slice(start, end);
  };

  it('le bloc « MOTEUR » est identique dans les deux fichiers', () => {
    const client = engineBlock(path.join(process.cwd(), 'src/utils/surveyFlow.js'));
    const api = engineBlock(path.join(process.cwd(), '../api/src/lib/surveyFlow.js'));
    expect(client).toBe(api);
  });
});

