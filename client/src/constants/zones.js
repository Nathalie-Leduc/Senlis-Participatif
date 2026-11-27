// ══════════════════════════════════════════════════════════
// Zone concernée par une proposition (S5R-10)
//
// Les 8 quartiers de Senlis, reliés aux contours de
// client/public/data/iris-senlis.geojson. Une même source pour le
// formulaire admin, la page d'une proposition et la carte « Explorer ».
//
// S5R2-06 : le « Centre Ville » de l'INSEE (un seul IRIS, 606120101) est
// coupé en deux d'après le plan municipal de 2018 — Centre historique et
// Quartier Saint-Vincent. Deux quartiers partagent donc le même code
// IRIS : chaque contour porte désormais son quartier dans
// `properties.quartier`, et c'est lui qui sert de clé (quartierOfFeature).
// Le code IRIS reste noté, pour savoir d'où vient chaque contour.
// ══════════════════════════════════════════════════════════

export const ZONE_QUARTIERS = [
  { value: 'CENTRE_HISTORIQUE', label: 'Centre historique', codeIris: '606120101' },
  { value: 'SAINT_VINCENT', label: 'Quartier Saint-Vincent', codeIris: '606120101' },
  { value: 'VILLEVERT', label: 'Villevert', codeIris: '606120201' },
  { value: 'VAL_AUNETTE_GATELIERE', label: "Val d'Aunette - La Gâtelière", codeIris: '606120301' },
  { value: 'BRICHEBAY', label: 'Brichebay', codeIris: '606120401' },
  { value: 'JARDINIERS', label: 'Jardiniers', codeIris: '606120501' },
  { value: 'ZONE_INDUSTRIELLE', label: 'Zone industrielle', codeIris: '606120601' },
  { value: 'BON_SECOURS', label: 'Bon Secours', codeIris: '606120701' },
];

export const ZONE_LABELS = Object.fromEntries(ZONE_QUARTIERS.map((q) => [q.value, q.label]));
const LABELS = ZONE_LABELS;

/**
 * Le quartier d'un contour du fichier. `properties.quartier` d'abord
 * (fichier découpé, S5R2-06) ; à défaut, le code IRIS — un ancien
 * fichier non découpé rattache tout le « Centre Ville » au Centre historique.
 * @param {{ properties?: { quartier?: string, code_iris?: string } }} feature
 * @returns {string | undefined} ex. 'SAINT_VINCENT'
 */
export function quartierOfFeature(feature) {
  const props = feature?.properties ?? {};
  return props.quartier ?? ZONE_QUARTIERS.find((q) => q.codeIris === props.code_iris)?.value;
}

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
    ? new Set(ZONE_QUARTIERS.map((q) => q.value))
    : new Set(proposal.zoneQuartiers ?? []);
  const features = iris.features.filter((f) => wanted.has(quartierOfFeature(f)));
  return features.length ? { type: 'FeatureCollection', features } : null;
}
