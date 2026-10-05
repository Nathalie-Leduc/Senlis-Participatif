// ══════════════════════════════════════════════════════════
// Petits calculs d'affichage des votes (S5-21)
//
// Sortis des composants pour deux raisons : les tester sans
// rendre de page, et garantir que la page publique et la page
// admin arrondissent EXACTEMENT de la même manière (sinon la
// mairie pourrait voir « 42,9 % » d'un côté et « 43 % » de l'autre).
// ══════════════════════════════════════════════════════════

import { PROFILE_DIMENSIONS } from '../constants/situation.js';

/**
 * Pourcentages POUR / CONTRE / NEUTRE, arrondis au dixième.
 * Aucun vote → 0 partout (jamais de division par zéro → NaN).
 *
 * @param {{ POUR: number, CONTRE: number, NEUTRE: number }} votes
 * @returns {{ POUR: number, CONTRE: number, NEUTRE: number }}
 *
 * @example votePercentages({ POUR: 2, CONTRE: 1, NEUTRE: 0 })
 * // → { POUR: 66.7, CONTRE: 33.3, NEUTRE: 0 }
 */
export function votePercentages(votes) {
  const total = votes.POUR + votes.CONTRE + votes.NEUTRE;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
  return { POUR: pct(votes.POUR), CONTRE: pct(votes.CONTRE), NEUTRE: pct(votes.NEUTRE) };
}

/**
 * Libellé lisible d'un segment, ex. ('situation', 'HORS_SENLIS')
 * → « Hors Senlis » ; valeur null → le nullLabel propre à l'axe.
 * Une valeur inconnue (enum enrichi côté API mais pas encore ici)
 * est affichée brute plutôt que de faire planter la page.
 *
 * @param {string} dimension - 'situation' | 'quartier' | 'travailleQuartier' | 'travailType'
 * @param {string|null} value
 * @returns {string}
 */
export function segmentLabel(dimension, value) {
  const dim = PROFILE_DIMENSIONS.find((d) => d.value === dimension);
  if (!dim) return value ?? '—';
  if (value === null || value === undefined) return dim.nullLabel;
  return dim.valueLabels[value] || value;
}
