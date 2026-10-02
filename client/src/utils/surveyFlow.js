// ══════════════════════════════════════════════════════════
// Parcours d'une enquête — côté navigateur (S5R-05)
//
// ⚠️ COPIE CONFORME de api/src/lib/surveyFlow.js : le navigateur et
// l'API DOIVENT appliquer exactement les mêmes règles, sinon la
// personne verrait une question que le serveur ne lui demande pas (ou
// l'inverse) et sa réponse serait refusée. Les deux fichiers sont
// testés avec les mêmes scénarios (surveyFlow.test.js / survey-engine-
// v2.test.js) : si tu modifies l'un, modifie l'autre.
//
// Règles, dans l'ordre du questionnaire :
//  1. sans condition → affichée ;
//  2. avec conditions → affichée si AU MOINS UNE option-condition a été
//     choisie parmi les questions déjà affichées (OU) ;
//  3. une option « termine l'enquête » choisie → plus rien après.
// ══════════════════════════════════════════════════════════

/**
 * @param {Array<{ id: string, order: number, conditionOptionIds?: string[],
 *   options?: Array<{ id: string, endsSurvey?: boolean }> }>} questions
 * @param {(questionId: string) => string[]} chosenOptionIds
 * @returns {string[]} id des questions affichées, dans l'ordre
 */
export function visibleQuestionIds(questions, chosenOptionIds) {
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  const chosenSoFar = new Set();
  const visible = [];

  for (const question of ordered) {
    const conditions = question.conditionOptionIds ?? [];
    const shown = conditions.length === 0 || conditions.some((id) => chosenSoFar.has(id));
    if (!shown) continue;

    visible.push(question.id);
    const chosen = chosenOptionIds(question.id) ?? [];
    for (const optionId of chosen) chosenSoFar.add(optionId);

    const ends = (question.options ?? []).some((o) => o.endsSurvey && chosen.includes(o.id));
    if (ends) break;
  }

  return visible;
}

/**
 * Raccourci pour le questionnaire : les options choisies à partir de
 * l'état `answers` de EnqueteRepondre ({ [questionId]: { optionId } |
 * { optionIds } | … }).
 */
export function chosenFromAnswers(answers) {
  return (questionId) => {
    const a = answers[questionId];
    return a?.optionIds ?? (a?.optionId ? [a.optionId] : []);
  };
}
