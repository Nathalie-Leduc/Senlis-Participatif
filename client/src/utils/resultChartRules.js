// ══════════════════════════════════════════════════════════
// Règles des graphiques de résultats (S5R2-04) — fonctions pures,
// sans React ni Chart.js, donc faciles à tester. Le pourquoi de chaque
// règle est expliqué en tête de components/ResultChart/ResultChart.jsx.
// ══════════════════════════════════════════════════════════

// Ordre fixe, jamais « tourné » : la 1re option a toujours la 1re couleur
export const SLICE_COLORS = ['#2479A6', '#E3A21A', '#B8432B', '#7A5BB0', '#3E9E5E'];
export const NO_ANSWER_COLOR = '#B9B2A4'; // gris neutre de la charte (« neutre » des votes)

const SINGLE_ANSWER_TYPES = ['OUI_NON', 'CHOIX_UNIQUE'];

/** Les secteurs sont-ils justes pour cette question ? (règle 2) */
export function canShowPie(question) {
  const options = question.options ?? [];
  return SINGLE_ANSWER_TYPES.includes(question.type)
    && options.length >= 3 && options.length <= SLICE_COLORS.length
    && options.every((o) => typeof o.offeredTo !== 'number');
}

/** Personnes qui ont vu la question sans choisir d'option (secteurs) */
export function noAnswerCount(question) {
  const answered = (question.options ?? []).reduce((sum, o) => sum + o.count, 0);
  return Math.max(0, (question.totalForQuestion ?? 0) - answered);
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
