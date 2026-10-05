// ══════════════════════════════════════════════════════════
// « Combien de questions ? » — annonce honnête (S5R-06)
//
// Recette du 30/09 : la page d'une enquête affichait « 34 questions »,
// le total du questionnaire COMPLET. Or chacun ne voit que les
// questions de son profil (souvent une douzaine) : ce chiffre faisait
// fuir avant même de commencer.
//
// Calculer le nombre EXACT de questions de chaque parcours possible
// demanderait d'essayer toutes les combinaisons de réponses. On dit
// donc simplement la vérité :
//  - questionnaire sans conditions → « 8 questions » (tout le monde
//    voit tout) ;
//  - questionnaire avec conditions ou fins anticipées → « questions
//    adaptées à votre situation », sans chiffre trompeur.
//
// Analogie : un formulaire administratif avec des « si vous avez
// coché oui, passez à la rubrique 4 » — personne ne remplit toutes
// les pages, et annoncer le nombre total de pages découragerait tout
// le monde pour rien.
// ══════════════════════════════════════════════════════════

/**
 * @param {Array<{ conditionOptionIds?: string[], options?: Array<{ endsSurvey?: boolean }> }>} questions
 * @returns {string}
 */
export function describeSurveyLength(questions) {
  const adaptive = questions.some((q) => (q.conditionOptionIds?.length ?? 0) > 0
    || (q.options ?? []).some((o) => o.endsSurvey));
  if (adaptive) return 'Questions adaptées à votre situation : vous ne verrez que celles qui vous concernent';
  return `${questions.length} question${questions.length > 1 ? 's' : ''}`;
}
