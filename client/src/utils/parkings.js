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

/** Parkings de l'API → repères pour MapView */
export function parkingMarkers(items) {
  return (items ?? [])
    .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
    .map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      label: p.name,
      regime: p.regime ?? null,
      charging: p.charging ?? 'AUCUNE',
      details: parkingDetails(p),
    }));
}

// ── Formulaire de l'écran d'administration ────────────────
// Tous les champs y sont du TEXTE (ce que contient un <input>) ; la
// conversion en nombres et en null se fait à l'envoi, en un seul endroit.
export const EMPTY_PARKING_FORM = {
  name: '', places: '', regime: '', charging: 'AUCUNE', chargingPoints: '', pmrPlaces: '', note: '', lat: '', lng: '',
};

const text = (v) => (v === null || v === undefined ? '' : String(v));

/** Fiche de l'API → valeurs du formulaire */
export function parkingToForm(p) {
  return {
    name: p.name, places: text(p.places), regime: p.regime ?? '', charging: p.charging ?? 'AUCUNE',
    chargingPoints: text(p.chargingPoints), pmrPlaces: text(p.pmrPlaces), note: p.note ?? '', lat: text(p.lat), lng: text(p.lng),
  };
}

/** « 49,2066 » ou « 49.2066 » → 49.2066 ; vide → null ; illisible → NaN (refusé par l'API) */
const decimal = (v) => (v.trim() === '' ? null : Number(v.trim().replace(',', '.')));

/** La position du formulaire, si latitude ET longitude sont des nombres */
export function formPosition(form) {
  const lat = decimal(form.lat);
  const lng = decimal(form.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
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
    lat: decimal(form.lat),
    lng: decimal(form.lng),
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
