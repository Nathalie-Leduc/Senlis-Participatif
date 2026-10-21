// ══════════════════════════════════════════════════════════
// Parkings gérés par l'administration (S5R2-05) — chargement depuis
// l'API et mise en forme pour la carte (fonctions pures, testées).
//
// Remplace l'extraction OpenStreetMap (utils/osmParkings.js, gardé
// pour son script d'extraction, s'il resservait un jour).
// ══════════════════════════════════════════════════════════

import { api } from '../services/api.js';
import { regimeMeta, PARKING_CHARGING } from '../constants/parkings.js';

/** Les lignes d'information d'un parking, en toutes lettres */
export function parkingDetails(parking) {
  const lines = [
    parking.places ? `${parking.places} places` : 'Nombre de places : non renseigné',
    regimeMeta(parking.regime).label,
  ];
  if (parking.pmrPlaces) lines.push(`${parking.pmrPlaces} place${parking.pmrPlaces > 1 ? 's' : ''} PMR`);
  if (parking.charging && parking.charging !== 'AUCUNE') {
    lines.push(`⚡ ${PARKING_CHARGING[parking.charging]}${parking.chargingPoints ? ` (${parking.chargingPoints})` : ''}`);
  }
  if (parking.note) lines.push(parking.note);
  return lines;
}

// ── Emplacements (recette du 20/10) ──────────────────────────
// Un parking a 0, 1 ou PLUSIEURS emplacements : des points (une aire de
// stationnement) et des traits (des places le long d'une rue, comme en
// zone rouge). Format GeoJSON, comme l'API : [longitude, latitude].
// Leaflet, lui, veut [latitude, longitude] : la conversion se fait ici,
// en un seul endroit.
// Analogie : deux pays qui écrivent les dates à l'envers l'un de
// l'autre — on convertit à la frontière, jamais au milieu du trajet.

/** Les emplacements d'un parking (tableau vide s'il n'est pas placé) */
export const locationsOf = (parking) => parking?.geometry?.geometries ?? [];

/** GeoJSON [lng, lat] → Leaflet [lat, lng] */
export const toLatLng = ([lng, lat]) => [lat, lng];

/** Leaflet { lat, lng } → point GeoJSON (6 décimales ≈ 10 cm) */
const round6 = (n) => Math.round(n * 1e6) / 1e6;
export const toPosition = ({ lat, lng }) => [round6(lng), round6(lat)];

/** Longueur d'un trait en mètres (formule de haversine), pour l'afficher */
export function lineLength(coordinates) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
      + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return Math.round(total);
}

/** « 2 emplacements », « 1 trait »… — ou « à placer » */
export function describeLocations(locations) {
  const points = locations.filter((g) => g.type === 'Point').length;
  const lines = locations.filter((g) => g.type === 'LineString').length;
  const parts = [];
  if (points) parts.push(`${points} point${points > 1 ? 's' : ''}`);
  if (lines) parts.push(`${lines} trait${lines > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' + ') : 'à placer';
}

/**
 * Parkings de l'API → ce que dessine MapView : un repère par POINT, une
 * ligne par TRAIT (chacun avec le nom, le régime et l'infobulle de son
 * parking). Un parking non placé n'apparaît pas.
 */
export function parkingShapes(items) {
  const points = [];
  const lines = [];
  for (const p of items ?? []) {
    const common = { label: p.name, regime: p.regime ?? null, charging: p.charging ?? 'AUCUNE', details: parkingDetails(p) };
    locationsOf(p).forEach((g, i) => {
      if (g.type === 'Point') {
        const [lat, lng] = toLatLng(g.coordinates);
        points.push({ id: `${p.id}-${i}`, parkingId: p.id, lat, lng, ...common });
      } else if (g.type === 'LineString') {
        lines.push({ id: `${p.id}-${i}`, parkingId: p.id, positions: g.coordinates.map(toLatLng), ...common });
      }
    });
  }
  return { points, lines };
}

// ── Formulaire de l'écran d'administration ────────────────
// Les champs texte y sont du TEXTE (ce que contient un <input>) ; la
// conversion en nombres et en null se fait à l'envoi, en un seul endroit.
// Les emplacements, eux, restent au format GeoJSON de l'API.
export const EMPTY_PARKING_FORM = {
  name: '', places: '', regime: '', charging: 'AUCUNE', chargingPoints: '', pmrPlaces: '', note: '', locations: [],
};

const text = (v) => (v === null || v === undefined ? '' : String(v));

/** Fiche de l'API → valeurs du formulaire */
export function parkingToForm(p) {
  return {
    name: p.name, places: text(p.places), regime: p.regime ?? '', charging: p.charging ?? 'AUCUNE',
    chargingPoints: text(p.chargingPoints), pmrPlaces: text(p.pmrPlaces), note: p.note ?? '', locations: locationsOf(p),
  };
}

/** « 49,2066 » ou « 49.2066 » → 49.2066 ; vide ou illisible → null */
function decimal(v) {
  const n = Number(String(v).trim().replace(',', '.'));
  return String(v).trim() !== '' && Number.isFinite(n) ? n : null;
}

/** Coordonnées tapées au clavier → { lat, lng }, ou null si l'une est illisible */
export function parseLatLng(latText, lngText) {
  const lat = decimal(latText);
  const lng = decimal(lngText);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

/** Formulaire → données envoyées à l'API ('' devient null : « effacer ») */
export function parkingFormToPayload(form) {
  const integer = (v) => (v === '' ? null : Number(v));
  return {
    name: form.name.trim(),
    places: integer(form.places),
    regime: form.regime || null,
    charging: form.charging,
    chargingPoints: form.charging === 'AUCUNE' ? null : integer(form.chargingPoints),
    pmrPlaces: integer(form.pmrPlaces),
    note: form.note.trim() || null,
    // Aucun emplacement = retiré de la carte
    geometry: form.locations.length ? { type: 'GeometryCollection', geometries: form.locations } : null,
  };
}

let promise = null;
/** Les parkings placés (une requête par visite) ; [] si l'API ne répond pas */
export function loadParkings() {
  promise ??= api.get('/parkings').then((d) => d.items).catch(() => {
    promise = null; // on retentera à la prochaine ouverture de la carte
    return [];
  });
  return promise;
}
