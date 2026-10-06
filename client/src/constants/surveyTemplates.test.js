import { describe, it, expect } from 'vitest';
import { SURVEY_TEMPLATES, PROFILE_QUESTIONS, instantiateQuestions } from './surveyTemplates.js';

const emptyQuestion = () => ({ key: 'x', label: '', helpText: '', type: 'CHOIX_UNIQUE', required: true, options: [], conditions: [], minValue: '', maxValue: '', maxChoicesFromKey: null, uiHint: null, syncsToProfile: null });

describe('modèles d’enquête', () => {
  it('chaque condition et chaque limite d’un modèle vise une option / question qui existe et la PRÉCÈDE', () => {
    for (const template of [...SURVEY_TEMPLATES, { id: 'profil', questions: PROFILE_QUESTIONS }]) {
      const questions = instantiateQuestions(template.questions, emptyQuestion);
      questions.forEach((q, index) => {
        const priorOptionKeys = questions.slice(0, index).flatMap((p) => p.options.map((o) => o.key));
        const priorQuestionKeys = questions.slice(0, index).map((p) => p.key);
        for (const key of q.conditions) expect(priorOptionKeys, `${template.id} / ${q.label}`).toContain(key);
        if (q.maxChoicesFromKey) expect(priorQuestionKeys).toContain(q.maxChoicesFromKey);
      });
      // Autant de conditions que de noms donnés : aucun nom mal orthographié
      const declared = template.questions.reduce((n, tq) => n + (tq.showIf?.length ?? 0), 0);
      expect(questions.reduce((n, q) => n + q.conditions.length, 0)).toBe(declared);
    }
  });

  it('deux insertions du même modèle ne partagent jamais une clé', () => {
    const a = instantiateQuestions(PROFILE_QUESTIONS, emptyQuestion);
    const b = instantiateQuestions(PROFILE_QUESTIONS, emptyQuestion);
    const keys = [...a, ...b].flatMap((q) => [q.key, ...q.options.map((o) => o.key)]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
