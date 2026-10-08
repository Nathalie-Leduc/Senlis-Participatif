// ══════════════════════════════════════════════════════════
// Carte « Explorer » : qu'est-ce qui concerne tel quartier ? (S5R-11)
//
// Recette du 30/09 : « Explorer la carte » ne montrait que les
// propositions (et seulement celles qui ont un point GPS), jamais les
// enquêtes. On rattache désormais chaque proposition ET chaque enquête
// ouverte à des quartiers :
//  - proposition : sa zone (S5R-10) — toute la ville, ou ses quartiers ;
//  - enquête : son public visé (S5R-07) — les quartiers de résidence ou
//    de travail visés ; « tout le monde », ou un public sans quartier
//    précis (hors Senlis, « tous les salarié·es »…), vaut toute la ville.
// Un élément « toute la ville » apparaît dans CHAQUE quartier.
// ══════════════════════════════════════════════════════════

import { ZONE_QUARTIERS } from '../constants/zones.js';
import { isEveryone } from './audience.js';

const ALL = ZONE_QUARTIERS.map((q) => q.value);
const NOT_CENTRE = ALL.filter((q) => q !== 'CENTRE_HISTORIQUE');

/** @returns {{ wholeCity: boolean, quartiers: string[] }} */
export function proposalPlaces(proposal) {
  return { wholeCity: Boolean(proposal.zoneWholeCity), quartiers: proposal.zoneQuartiers ?? [] };
}

/** @returns {{ wholeCity: boolean, quartiers: string[] }} */
export function surveyPlaces(survey) {
  const a = survey.audience;
  if (!a || isEveryone(a)) return { wholeCity: true, quartiers: [] };

  const quartiers = new Set();
  let wholeCity = false;
  if (a.situations.includes('CENTRE_RESIDENT')) quartiers.add('CENTRE_HISTORIQUE');
  if (a.situations.includes('AUTRE_QUARTIER')) (a.quartiers.length ? a.quartiers : NOT_CENTRE).forEach((q) => quartiers.add(q));
  if (a.situations.includes('HORS_SENLIS')) wholeCity = true; // des visiteurs : la ville entière
  if (a.workQuartiers.length) a.workQuartiers.forEach((q) => quartiers.add(q));
  else if (a.workTypes.length) wholeCity = true; // « les salarié·es », où qu'ils travaillent
  return { wholeCity, quartiers: [...quartiers] };
}

const concerns = (places, quartier) => places.wholeCity || places.quartiers.includes(quartier);

/**
 * @returns {{ proposals: object[], surveys: object[] }} ce qui concerne ce
 *   quartier — chaque élément porte `wholeCity` pour l'afficher à part
 */
export function itemsForQuartier(quartier, proposals, surveys) {
  return {
    proposals: proposals.filter((p) => concerns(proposalPlaces(p), quartier))
      .map((p) => ({ ...p, wholeCity: proposalPlaces(p).wholeCity })),
    surveys: surveys.filter((s) => concerns(surveyPlaces(s), quartier))
      .map((s) => ({ ...s, wholeCity: surveyPlaces(s).wholeCity })),
  };
}

/** Éléments qui ne sont rattachés à AUCUN quartier (zone non déclarée) */
export function unplacedProposals(proposals) {
  return proposals.filter((p) => !p.zoneWholeCity && !(p.zoneQuartiers?.length));
}

// ══ S5R-11 v2 (retours du 07/10) ═══════════════════════════
// Par défaut : TOUTE LA VILLE (rien de sélectionné) ; sinon un OU
// plusieurs quartiers cochés.

/**
 * @param {string[]} selected - quartiers cochés ([] = toute la ville)
 * @returns {{ proposals: object[], surveys: object[] }} tout ce qui est
 *   en cours (toute la ville), ou ce qui concerne AU MOINS UN des
 *   quartiers cochés. Chaque élément porte `wholeCity`.
 */
export function itemsForSelection(selected, proposals, surveys) {
  const keep = (places) => selected.length === 0 || places.wholeCity
    || places.quartiers.some((q) => selected.includes(q));
  return {
    proposals: proposals.filter((p) => keep(proposalPlaces(p))).map((p) => ({ ...p, wholeCity: proposalPlaces(p).wholeCity })),
    surveys: surveys.filter((s) => keep(surveyPlaces(s))).map((s) => ({ ...s, wholeCity: surveyPlaces(s).wholeCity })),
  };
}

/**
 * Centre approximatif de chaque quartier IRIS (moyenne des sommets du
 * contour) : sert à placer sur la carte les propositions et enquêtes
 * rattachées à un quartier SANS point précis. Approximatif, mais
 * toujours DANS le quartier pour des formes aussi compactes.
 * @returns {Map<string, [number, number]>} code IRIS → [lat, lng]
 */
export function irisCentroids(iris) {
  const centroids = new Map();
  for (const feature of iris?.features ?? []) {
    const { type, coordinates } = feature.geometry ?? {};
    // Polygon : [anneau extérieur, trous…] ; MultiPolygon : [[anneau…]…]
    const ring = type === 'Polygon' ? coordinates?.[0] : type === 'MultiPolygon' ? coordinates?.[0]?.[0] : null;
    if (!ring?.length) continue;
    const lng = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
    const lat = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
    centroids.set(feature.properties?.code_iris, [lat, lng]);
  }
  return centroids;
}

/**
 * Repères de la carte « Explorer » :
 *  - une proposition avec un point précis → à ce point ;
 *  - sinon, un repère au centre de chacun de ses quartiers (seulement
 *    les quartiers cochés, s'il y en a) ;
 *  - « toute la ville » → un repère au centre-ville de Senlis.
 * Plusieurs repères au même endroit sont écartés en petit cercle, pour
 * rester tous cliquables.
 *
 * @param {object} opts
 * @returns {Array<{ id, lat, lng, label, href, kind }>}
 */
export function mapMarkers({ proposals, surveys, centroids, codeOf, selected, cityCenter }) {
  const spots = new Map(); // « lat,lng » → nombre de repères déjà posés là
  const markers = [];
  const place = (id, [lat, lng], item) => {
    const key = `${lat},${lng}`;
    const n = spots.get(key) ?? 0;
    spots.set(key, n + 1);
    // 1er repère au centre, les suivants sur un cercle de ~120 m
    const angle = (n * 2 * Math.PI) / 6;
    const offset = n === 0 ? [0, 0] : [0.0011 * Math.sin(angle), 0.0016 * Math.cos(angle)];
    markers.push({ id, lat: lat + offset[0], lng: lng + offset[1], ...item });
  };

  const add = (item, places, kind, href, point) => {
    const base = { label: item.title, href, kind };
    if (point) return place(`${kind}-${item.id}`, point, base);
    if (places.wholeCity) return place(`${kind}-${item.id}-ville`, cityCenter, { ...base, label: `${item.title} (toute la ville)` });
    for (const q of places.quartiers) {
      if (selected.length && !selected.includes(q)) continue;
      const center = centroids.get(codeOf(q));
      if (center) place(`${kind}-${item.id}-${q}`, center, base);
    }
    return undefined;
  };

  for (const p of proposals) {
    add(p, proposalPlaces(p), 'proposal', `/propositions/${p.slug}`, p.lat && p.lng ? [p.lat, p.lng] : null);
  }
  for (const s of surveys) add(s, surveyPlaces(s), 'survey', `/enquetes/${s.slug}`, null);
  return markers;
}
