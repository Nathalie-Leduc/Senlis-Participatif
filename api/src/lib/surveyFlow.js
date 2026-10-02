// ══════════════════════════════════════════════════════════
// Parcours d'une enquête : quelles questions une personne voit-elle ?
// (S5R-05 — moteur d'enquête v2)
//
// Les mêmes règles s'appliquent à trois endroits, et doivent donner
// EXACTEMENT le même résultat :
//  - dans le navigateur, pour afficher les questions une à une et le
//    « Question 3 sur 7 » (client/src/utils/surveyFlow.js — copie
//    conforme de ce fichier, testée avec les mêmes scénarios) ;
//  - à la soumission, pour savoir quelles questions étaient
//    obligatoires pour CETTE personne ;
//  - dans les résultats, pour compter combien de personnes ont VU
//    chaque question (base des pourcentages).
//
// Les règles, dans l'ordre du questionnaire :
//  1. une question sans condition est affichée ;
//  2. une question avec conditions est affichée si AU MOINS UNE de
//     ses options-conditions a été choisie (OU) — parmi les réponses
//     aux questions déjà AFFICHÉES (une réponse à une question cachée
//     ne compte pas) ;
//  3. dès qu'une option « termine l'enquête » est choisie, plus aucune
//     question n'est affichée après elle.
//
// Analogie : un jeu de piste. Chaque réponse ouvre (ou non) les
// étapes suivantes, et certaines réponses mènent directement à
// l'arrivée.
// ══════════════════════════════════════════════════════════

/**
 * @param {Array<{ id: string, order: number, conditionOptionIds: string[],
 *   options?: Array<{ id: string, endsSurvey?: boolean }> }>} questions
 * @param {(questionId: string) => string[]} chosenOptionIds
 *   les options choisies à une question (tableau vide si pas de réponse)
 * @returns {string[]} les id des questions affichées, dans l'ordre
 *
 * @example
 * visibleQuestionIds(questions, (id) => answers[id]?.optionIds ?? [])
 */
export function visibleQuestionIds(questions, chosenOptionIds) {
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  const chosenSoFar = new Set(); // options choisies dans les questions AFFICHÉES
  const visible = [];

  for (const question of ordered) {
    const conditions = question.conditionOptionIds ?? [];
    const shown = conditions.length === 0 || conditions.some((id) => chosenSoFar.has(id));
    if (!shown) continue;

    visible.push(question.id);
    const chosen = chosenOptionIds(question.id) ?? [];
    for (const optionId of chosen) chosenSoFar.add(optionId);

    // Fin anticipée : une option choisie termine l'enquête
    const ends = (question.options ?? []).some((o) => o.endsSurvey && chosen.includes(o.id));
    if (ends) break;
  }

  return visible;
}

/**
 * Remet une question lue en base (avec `conditions: [{ optionId }]`)
 * dans la forme attendue par visibleQuestionIds et par le client :
 * `conditionOptionIds: [...]`.
 */
export function withConditionIds(question) {
  const { conditions, ...rest } = question;
  return { ...rest, conditionOptionIds: (conditions ?? []).map((c) => c.optionId) };
}
