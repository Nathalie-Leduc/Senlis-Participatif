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
//     question n'est affichée après elle ;
//  4. S5R2-02 : une OPTION peut elle aussi être conditionnelle — elle
//     n'est proposée que si l'un de ses déclencheurs a été choisi plus
//     tôt (détail des règles dans surveyPath ci-dessous).
//
// ⚠️ client/src/utils/surveyFlow.js contient une COPIE CONFORME du bloc
// « MOTEUR » ci-dessous (vérifiée par client/src/utils/surveyFlow.test.js).
//
// Analogie : un jeu de piste. Chaque réponse ouvre (ou non) les
// étapes suivantes, et certaines réponses mènent directement à
// l'arrivée.
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
 * Remet une question lue en base (avec `conditions: [{ optionId }]`, et
 * pour chaque option `conditions: [{ triggerOptionId }]` — S5R2-02)
 * dans la forme attendue par le moteur et par le client :
 * `conditionOptionIds: [...]` sur la question ET sur chaque option.
 */
export function withConditionIds(question) {
  const { conditions, options, ...rest } = question;
  return {
    ...rest,
    conditionOptionIds: (conditions ?? []).map((c) => c.optionId),
    ...(options && {
      options: options.map(({ conditions: optionConditions, ...option }) => ({
        ...option,
        conditionOptionIds: (optionConditions ?? []).map((c) => c.triggerOptionId),
      })),
    }),
  };
}
