// ══════════════════════════════════════════════════════════
// Public visé d'une enquête — côté navigateur (S5R-07)
//
// L'API envoie `audience` : { situations, quartiers, workQuartiers,
// workTypes } (voir api/src/lib/audience.js pour la logique « qui est
// visé »). Ici, on le transforme en PHRASE lisible :
//   { situations: ['CENTRE_RESIDENT'], workQuartiers: ['CENTRE_HISTORIQUE'],
//     workTypes: ['COMMERCANT'] }
//   → « habitants du centre historique, et personnes qui dirigent une
//      activité dans le centre historique »
// ══════════════════════════════════════════════════════════

import { QUARTIER_LABELS, TRAVAIL_QUARTIER_LABELS } from '../constants/situation.js';

export const EMPTY_AUDIENCE = { situations: [], quartiers: [], workQuartiers: [], workTypes: [] };

/** Aucun critère = tout le monde */
export function isEveryone(audience) {
  return !audience || Object.values(audience).every((list) => !list || list.length === 0);
}

/** « a », « a et b », « a, b et c » */
function joinFr(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;
}

/**
 * @param {typeof EMPTY_AUDIENCE} audience
 * @returns {string} ex. « tout le monde », « habitants du centre historique »
 */
export function describeAudience(audience) {
  if (isEveryone(audience)) return 'tout le monde';
  const parts = [];

  // ── Résidence ──
  for (const situation of audience.situations) {
    if (situation === 'CENTRE_RESIDENT') parts.push('habitants du centre historique');
    if (situation === 'HORS_SENLIS') parts.push('personnes qui résident hors de Senlis');
    if (situation === 'AUTRE_QUARTIER') {
      parts.push(audience.quartiers.length
        ? `habitants de ${joinFr(audience.quartiers.map((q) => QUARTIER_LABELS[q] ?? q))}`
        : 'habitants des autres quartiers de Senlis');
    }
  }

  // ── Travail ──
  if (audience.workQuartiers.length || audience.workTypes.length) {
    const roles = audience.workTypes.length === 1
      ? (audience.workTypes[0] === 'COMMERCANT' ? 'personnes qui dirigent une activité' : 'salarié·es')
      : 'personnes qui travaillent';
    const where = audience.workQuartiers.length
      ? ` ${audience.workQuartiers.includes('CENTRE_HISTORIQUE') && audience.workQuartiers.length === 1
        ? 'dans le centre historique'
        : `à ${joinFr(audience.workQuartiers.map((q) => TRAVAIL_QUARTIER_LABELS[q] ?? q))}`}`
      : ' à Senlis';
    parts.push(`${roles}${where}`);
  }

  return joinFr(parts);
}
