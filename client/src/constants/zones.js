// ══════════════════════════════════════════════════════════
// Zone concernée par une proposition (S5R-10)
//
// Les 7 quartiers IRIS de Senlis (découpage INSEE), avec le code qui
// les relie aux contours de client/public/data/iris-senlis.geojson.
// Une même source pour le formulaire admin, la page d'une proposition
// et, en S5R-11, la carte « Explorer ».
// ══════════════════════════════════════════════════════════

export const ZONE_QUARTIERS = [
  { value: 'CENTRE_HISTORIQUE', label: 'Centre historique', codeIris: '606120101' },
  { value: 'VILLEVERT', label: 'Villevert', codeIris: '606120201' },
  { value: 'VAL_AUNETTE_GATELIERE', label: "Val d'Aunette - La Gâtelière", codeIris: '606120301' },
  { value: 'BRICHEBAY', label: 'Brichebay', codeIris: '606120401' },
  { value: 'JARDINIERS', label: 'Jardiniers', codeIris: '606120501' },
  { value: 'ZONE_INDUSTRIELLE', label: 'Zone industrielle', codeIris: '606120601' },
  { value: 'BON_SECOURS', label: 'Bon Secours', codeIris: '606120701' },
];

const LABELS = Object.fromEntries(ZONE_QUARTIERS.map((q) => [q.value, q.label]));

/** « a », « a et b », « a, b et c » */
const joinFr = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`);

/**
 * @param {{ zoneWholeCity?: boolean, zoneQuartiers?: string[] }} proposal
 * @returns {string|null} ex. « Toute la ville », « Centre historique et Brichebay », ou null
 */
export function describeZone(proposal) {
  if (proposal?.zoneWholeCity) return 'Toute la ville';
  const quartiers = proposal?.zoneQuartiers ?? [];
  if (!quartiers.length) return null;
  return joinFr(quartiers.map((q) => LABELS[q] ?? q));
}

/**
 * Contours IRIS de la zone : une FeatureCollection avec les seuls
 * quartiers concernés (tous pour « toute la ville »), ou null.
 * @param {object|null} iris - le fichier iris-senlis.geojson
 */
export function zoneFeatures(iris, proposal) {
  if (!iris || !proposal) return null;
  const wanted = proposal.zoneWholeCity
    ? new Set(ZONE_QUARTIERS.map((q) => q.codeIris))
    : new Set((proposal.zoneQuartiers ?? []).map((v) => ZONE_QUARTIERS.find((q) => q.value === v)?.codeIris));
  const features = iris.features.filter((f) => wanted.has(f.properties?.code_iris));
  return features.length ? { type: 'FeatureCollection', features } : null;
}
