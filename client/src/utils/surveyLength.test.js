import { describe, it, expect } from 'vitest';
import { describeSurveyLength } from './surveyLength.js';

describe('describeSurveyLength', () => {
  it('annonce le nombre exact quand tout le monde voit toutes les questions', () => {
    expect(describeSurveyLength([{}, {}, {}])).toBe('3 questions');
    expect(describeSurveyLength([{}])).toBe('1 question');
  });

  it("n'annonce PAS le total d'un questionnaire à parcours (le « 34 questions » de la recette)", () => {
    const withCondition = [{ conditionOptionIds: [] }, { conditionOptionIds: ['o1'] }];
    const withEnd = [{ options: [{ endsSurvey: true }] }, {}];
    expect(describeSurveyLength(withCondition)).toMatch(/adaptées à votre situation/);
    expect(describeSurveyLength(withEnd)).toMatch(/adaptées à votre situation/);
  });
});
