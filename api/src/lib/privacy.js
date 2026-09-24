// ══════════════════════════════════════════════════════════
// Confidentialité statistique — S5-21 (volet audit RGPD)
//
// Le problème : segmenter des résultats par profil (« salarié·e·s de
// la Zone industrielle », « résidents du centre »…) peut produire un
// groupe d'UNE SEULE personne. Afficher « 1 votant — 100 % CONTRE »
// revient alors à publier son vote nominativement, même sans nom :
// quiconque sait qui travaille là peut le deviner.
//
// La règle : tout groupe de 1 à 4 personnes est MASQUÉ (on dit qu'il
// existe, jamais combien il pèse ni ce qu'il a répondu). C'est le
// principe du « secret statistique » appliqué par l'INSEE : une case
// de tableau trop petite n'est jamais publiée.
//
// Analogie : dans un isoloir, on ne dépouille pas une urne qui ne
// contient qu'un bulletin — tout le monde saurait pour qui a voté
// l'unique électeur du bureau.
//
// Un groupe VIDE (0), lui, n'est pas masqué : « personne n'est dans
// ce cas » ne révèle l'opinion de personne.
// ══════════════════════════════════════════════════════════

/** Taille minimale d'un groupe pour que son détail soit affiché. */
export const MIN_GROUP_SIZE = 5;

/**
 * Un groupe est-il trop petit pour être montré en détail ?
 *
 * @param {number} count - nombre de personnes dans le groupe
 * @param {number} [min=MIN_GROUP_SIZE]
 * @returns {boolean} true si 1 ≤ count < min
 *
 * @example
 * isTooSmall(0) // false — groupe vide, rien à protéger
 * isTooSmall(3) // true  — masqué
 * isTooSmall(5) // false — affiché
 */
export function isTooSmall(count, min = MIN_GROUP_SIZE) {
  return count > 0 && count < min;
}

/**
 * Masque, dans une liste de questions de résultats d'enquête (le
 * format produit par computeResults() dans surveysController.js),
 * celles qui n'ont été posées qu'à un trop petit nombre de personnes.
 *
 * Pourquoi question par question, et pas seulement segment par
 * segment ? Un segment de 20 personnes peut contenir une question
 * BRANCHÉE vue par 2 d'entre elles seulement (ex. « Où garez-vous
 * votre véhicule professionnel ? ») : le segment passe le seuil, mais
 * pas cette question-là.
 *
 * Fonction PURE (ne modifie pas le tableau reçu, ne touche pas la
 * base) : facile à tester unitairement.
 *
 * @param {Array<object>} questions
 * @returns {Array<object>} nouvelles questions, les trop petites
 *   réduites à { id, label, type, showIfOptionId, masked: true,
 *   totalForQuestion: null }
 */
export function maskSmallQuestions(questions, min = MIN_GROUP_SIZE) {
  return questions.map((question) => {
    if (!isTooSmall(question.totalForQuestion, min)) {
      return { ...question, masked: false };
    }
    // On ne garde QUE ce qui décrit la question elle-même — ni les
    // comptes par option, ni les statistiques numériques, ni le
    // nombre exact de personnes concernées.
    return {
      id: question.id,
      label: question.label,
      type: question.type,
      showIfOptionId: question.showIfOptionId,
      totalForQuestion: null,
      masked: true,
    };
  });
}
