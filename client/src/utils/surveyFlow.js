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
//  3. une option « termine l'enquête » choisie → plus rien après ;
//  4. S5R2-02 : une OPTION conditionnelle n'est proposée que si l'un de
//     ses déclencheurs a été choisi plus tôt.
// Le bloc « MOTEUR » est vérifié identique à celui de l'API par
// surveyFlow.test.js.
// ══════════════════════════════════════════════════════════

// ── MOTEUR — début de la partie identique API / navigateur ──
// (un test vérifie que ce bloc est le même dans les deux fichiers)

/**
 * Les options d'une question PROPOSÉES à la personne (S5R2-02) : sans
 * condition, toujours ; avec conditions, si l'un de leurs déclencheurs
 * a été choisi plus tôt (OU).
 * @param {{ options?: Array<{ id: string, conditionOptionIds?: string[] }> }} question
 * @param {Set<string>} chosenSoFar - options choisies aux questions AFFICHÉES avant
 * @returns {string[]} id des options proposées, dans l'ordre
 */
export function offeredOptionIds(question, chosenSoFar) {
  return (question.options ?? [])
    .filter((o) => {
      const conditions = o.conditionOptionIds ?? [];
      return conditions.length === 0 || conditions.some((id) => chosenSoFar.has(id));
    })
    .map((o) => o.id);
}

/**
 * Le parcours complet d'une personne : questions affichées ET, pour
 * chacune, les options proposées.
 *
 * Règles, dans l'ordre du questionnaire :
 *  1. une question sans condition est affichée ;
 *  2. une question avec conditions est affichée si AU MOINS UNE de ses
 *     options-conditions a été choisie (OU) parmi les questions déjà
 *     AFFICHÉES (une réponse à une question cachée ne compte pas) ;
 *  3. S5R2-02 : parmi ses options, seules sont proposées celles sans
 *     condition, ou dont l'un des déclencheurs a été choisi plus tôt ;
 *     une question à options dont AUCUNE n'est proposée est sautée
 *     (on ne pose pas une question sans réponse possible) ;
 *  4. un choix parmi des options NON proposées ne compte pas ;
 *  5. dès qu'une option « termine l'enquête » est choisie, plus aucune
 *     question n'est affichée après elle.
 *
 * Analogie : un jeu de piste. Chaque réponse ouvre (ou non) les étapes
 * suivantes — et parfois seulement certains chemins d'une étape.
 *
 * @param {Array<{ id: string, order: number, conditionOptionIds?: string[],
 *   options?: Array<{ id: string, endsSurvey?: boolean, conditionOptionIds?: string[] }> }>} questions
 * @param {(questionId: string) => string[]} chosenOptionIds
 *   les options choisies à une question (tableau vide si pas de réponse)
 * @returns {{ questionIds: string[], offeredOptions: Map<string, string[]> }}
 */
export function surveyPath(questions, chosenOptionIds) {
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  const chosenSoFar = new Set(); // options choisies dans les questions AFFICHÉES
  const questionIds = [];
  const offeredOptions = new Map();

  for (const question of ordered) {
    const conditions = question.conditionOptionIds ?? [];
    const shown = conditions.length === 0 || conditions.some((id) => chosenSoFar.has(id));
    if (!shown) continue;

    const hasOptions = (question.options ?? []).length > 0;
    const offered = offeredOptionIds(question, chosenSoFar);
    if (hasOptions && offered.length === 0) continue; // règle 3

    questionIds.push(question.id);
    offeredOptions.set(question.id, offered);

    const offeredSet = new Set(offered);
    const chosen = (chosenOptionIds(question.id) ?? []).filter((id) => offeredSet.has(id)); // règle 4
    for (const optionId of chosen) chosenSoFar.add(optionId);

    // Fin anticipée : une option choisie termine l'enquête
    const ends = (question.options ?? []).some((o) => o.endsSurvey && chosen.includes(o.id));
    if (ends) break;
  }

  return { questionIds, offeredOptions };
}

/**
 * Raccourci : seulement les id des questions affichées, dans l'ordre.
 * @example visibleQuestionIds(questions, (id) => answers[id]?.optionIds ?? [])
 */
export function visibleQuestionIds(questions, chosenOptionIds) {
  return surveyPath(questions, chosenOptionIds).questionIds;
}

// ── MOTEUR — fin de la partie identique API / navigateur ──

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
