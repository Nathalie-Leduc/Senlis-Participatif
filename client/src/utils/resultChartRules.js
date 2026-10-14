// ══════════════════════════════════════════════════════════
// Règles des graphiques de résultats (S5R2-04) — fonctions pures,
// sans React ni Chart.js, donc faciles à tester. Le pourquoi de chaque
// règle est expliqué en tête de components/ResultChart/ResultChart.jsx.
// ══════════════════════════════════════════════════════════

// ── Couleurs des secteurs (recette du 14/10) ─────────────────
// Huit teintes proches de la charte (bleu Nonette, doré, brique…, en
// plus franc). Dans un anneau, chaque part touche DEUX voisines — et la
// dernière touche la première. Aucune suite fixe de 8 couleurs ne
// garantit que toutes les voisines se distinguent quel que soit le
// nombre de parts : on a donc calculé, pour chaque nombre de parts (2 à
// 8), un ordre qui fait le tour complet de l'anneau sans deux voisines
// confondables, même pour un daltonien (outil de validation de palette,
// écart minimal ΔE 15 ; 8 suffit). Analogie : placer des invités autour
// d'une table ronde — on ne met pas côte à côte deux personnes habillées
// pareil, et le dernier invité est voisin du premier.
export const PIE_COLORS_BY_COUNT = {
  1: ['#2479A6'],
  2: ['#2479A6', '#E3A21A'],
  3: ['#2479A6', '#E3A21A', '#B8432B'],
  4: ['#2479A6', '#E3A21A', '#7A5BB0', '#B8432B'],
  5: ['#2479A6', '#E3A21A', '#B8432B', '#7A5BB0', '#3E9E5E'],
  6: ['#2479A6', '#E3A21A', '#1AA3A3', '#B8432B', '#7A5BB0', '#3E9E5E'],
  7: ['#2479A6', '#E3A21A', '#B8432B', '#1AA3A3', '#E07B28', '#7A5BB0', '#3E9E5E'],
  8: ['#2479A6', '#B8432B', '#1AA3A3', '#E3A21A', '#9C4A7A', '#E07B28', '#7A5BB0', '#3E9E5E'],
};
/** Au-delà de 8 parts colorées, les plus petites sont regroupées */
export const MAX_COLORED_SLICES = 8;
// Deux neutres, placés en fin d'anneau (entre la dernière part et la
// première) : vérifiés distincts de chacune des 8 couleurs et entre eux
export const OTHERS_COLOR = '#4A4540'; // « Autres réponses » (regroupées)
export const NO_ANSWER_COLOR = '#D8D2C6'; // « Sans réponse »

const SINGLE_ANSWER_TYPES = ['OUI_NON', 'CHOIX_UNIQUE'];

/**
 * Les secteurs sont-ils justes pour cette question ?
 * Oui pour toute question à RÉPONSE UNIQUE (chaque personne est dans une
 * seule part : les parts forment un tout). Non pour les choix multiples :
 * une personne compterait dans plusieurs parts, la somme dépasserait 100 %.
 * (Recette du 14/10 : plus de limite au nombre d'options — les petites
 * parts sont regroupées, voir pieSlices.)
 */
export function canShowPie(question) {
  return SINGLE_ANSWER_TYPES.includes(question.type) && (question.options ?? []).length >= 2;
}

/** Personnes qui ont vu la question sans choisir d'option (secteurs) */
export function noAnswerCount(question) {
  const answered = (question.options ?? []).reduce((sum, o) => sum + o.count, 0);
  return Math.max(0, (question.totalForQuestion ?? 0) - answered);
}

/**
 * Les parts de l'anneau, dans l'ordre des options.
 *  - une option choisie par personne n'a pas de part (une part vide ne
 *    se dessine pas ; elle reste dans le tableau, avec 0) ;
 *  - plus de 8 options choisies : les 7 plus grosses gardent leur part,
 *    les autres sont regroupées en « Autres réponses » (le tableau, lui,
 *    garde chaque option) — au-delà de 8 couleurs, on ne les distingue
 *    plus ;
 *  - « Sans réponse » en dernier, si des personnes ont passé la question.
 *
 * @returns {{ slices: Array<{ label: string, count: number, color: string }>,
 *   colorOf: Map<string, string> }} colorOf : couleur de chaque option
 *   (id) qui a une part, ou la couleur « Autres » si elle est regroupée
 */
export function pieSlices(question) {
  const chosen = (question.options ?? []).filter((o) => o.count > 0);
  let kept = chosen;
  let folded = [];
  if (chosen.length > MAX_COLORED_SLICES) {
    const biggest = new Set([...chosen].sort((a, b) => b.count - a.count).slice(0, MAX_COLORED_SLICES - 1));
    kept = chosen.filter((o) => biggest.has(o));
    folded = chosen.filter((o) => !biggest.has(o));
  }

  const palette = PIE_COLORS_BY_COUNT[kept.length] ?? [];
  const colorOf = new Map();
  const slices = kept.map((o, i) => {
    colorOf.set(o.id ?? o.label, palette[i]);
    return { label: o.label, count: o.count, color: palette[i] };
  });
  if (folded.length) {
    for (const o of folded) colorOf.set(o.id ?? o.label, OTHERS_COLOR);
    slices.push({ label: 'Autres réponses', count: folded.reduce((sum, o) => sum + o.count, 0), color: OTHERS_COLOR });
  }
  const noAnswer = noAnswerCount(question);
  if (noAnswer > 0) slices.push({ label: 'Sans réponse', count: noAnswer, color: NO_ANSWER_COLOR });
  return { slices, colorOf };
}

/**
 * Coupe un intitulé long en lignes d'environ `max` caractères (Chart.js
 * affiche un tableau de chaînes sur plusieurs lignes) — sans couper un mot.
 */
export function wrapLabel(text, max = 28) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
