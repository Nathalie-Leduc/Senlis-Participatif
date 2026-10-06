// ══════════════════════════════════════════════════════════
// Export des résultats d'enquête (S5R-08)
//
// Recette du 30/09 : « pouvoir exporter les résultats en données
// (Excel, JSON…) ». On exporte les résultats AGRÉGÉS — exactement ce
// qui est affiché à l'écran, filtre compris — jamais les bulletins
// individuels :
//  - une question masquée par le secret statistique reste « masquée »
//    dans le fichier (le fichier circule plus loin que l'écran) ;
//  - le texte libre n'est pas exporté, seulement le nombre de réponses
//    (un texte peut suffire à reconnaître son auteur — même règle que
//    l'impression).
//
// Deux formats :
//  - CSV, pour Excel / LibreOffice : séparateur « ; » et marque BOM en
//    tête, sinon un Excel français mélange les colonnes et abîme les
//    accents (« dÃ©placements ») ;
//  - JSON, pour un traitement par programme (open data, tableur avancé).
// ══════════════════════════════════════════════════════════

const TYPE_LABELS = {
  CHOIX_UNIQUE: 'Choix unique', CHOIX_MULTIPLE: 'Choix multiple', OUI_NON: 'Oui / Non',
  NOMBRE: 'Nombre', TEXTE_LIBRE: 'Texte libre',
};

/** Échappe une cellule CSV : guillemets doublés, cellule entre guillemets */
function cell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Une ligne par option (choix), par statistique (nombre) ou par
 * question (texte libre, question masquée).
 *
 * @param {{ survey: { title: string }, totalResponses: number|null }} results
 * @param {object[]} questions - les questions AFFICHÉES (filtre de question compris)
 * @param {string} publicLabel - ex. « habitants du centre historique »
 */
export function toCsv(results, questions, publicLabel) {
  const rows = [
    ['Enquête', results.survey.title],
    ['Public analysé', publicLabel],
    ['Répondants', results.totalResponses ?? 'masqué (moins de 5)'],
    ['Exporté le', new Date().toLocaleString('fr-FR')],
    [],
    ['Question', 'Type', 'Personnes concernées', 'Réponse', 'Nombre', 'Pourcentage'],
  ];

  for (const q of questions) {
    const head = [q.label, TYPE_LABELS[q.type] ?? q.type];
    if (q.masked) {
      rows.push([...head, 'masqué (moins de 5)', '', '', '']);
    } else if (q.options) {
      for (const o of q.options) rows.push([...head, q.totalForQuestion, o.label, o.count, `${o.percentage} %`]);
    } else if (q.stats) {
      rows.push([...head, q.totalForQuestion, 'Réponses', q.stats.count, '']);
      if (q.stats.average !== null) rows.push([...head, q.totalForQuestion, 'Moyenne', Math.round(q.stats.average * 10) / 10, '']);
      if (q.stats.min !== null) rows.push([...head, q.totalForQuestion, 'Minimum', q.stats.min, '']);
      if (q.stats.max !== null) rows.push([...head, q.totalForQuestion, 'Maximum', q.stats.max, '']);
    } else {
      rows.push([...head, q.totalForQuestion, 'Réponses libres (contenu non exporté)', q.totalAnswered ?? 0, '']);
    }
  }

  // \uFEFF : marque BOM — Excel comprend alors que le fichier est en UTF-8
  return `\uFEFF${rows.map((r) => r.map(cell).join(';')).join('\r\n')}`;
}

/** Même contenu en JSON (sans les textes libres bruts) */
export function toJson(results, questions, publicLabel) {
  return {
    survey: results.survey.title,
    publicAnalyse: publicLabel,
    repondants: results.totalResponses,
    secretStatistique: `Groupes et questions de moins de ${results.minGroupSize ?? 5} personnes masqués`,
    exporteLe: new Date().toISOString(),
    questions: questions.map((q) => (q.masked
      ? { question: q.label, type: q.type, masque: true }
      : {
        question: q.label,
        type: q.type,
        personnesConcernees: q.totalForQuestion,
        ...(q.options && { reponses: q.options.map((o) => ({ reponse: o.label, nombre: o.count, pourcentage: o.percentage })) }),
        ...(q.stats && { statistiques: q.stats }),
        ...(q.totalAnswered !== undefined && { reponsesLibres: q.totalAnswered }),
      })),
  };
}
