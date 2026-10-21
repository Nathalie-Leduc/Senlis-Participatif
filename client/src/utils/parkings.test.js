// ══════════════════════════════════════════════════════════
// Tests — parkings gérés par l'administration (S5R2-05) : mise en
// forme pour la carte et formulaire de l'écran d'administration.
// Recette du 20/10 : plusieurs points et des traits par parking.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  parkingDetails, parkingShapes, parkingToForm, parkingFormToPayload, parseLatLng, EMPTY_PARKING_FORM,
  describeLocations, lineLength, toLatLng, toPosition,
} from './parkings.js';
import { PARKING_REGIMES, regimeMeta } from '../constants/parkings.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const RUE = { type: 'LineString', coordinates: [[2.5862, 49.2061], [2.5871, 49.2058]] };
const ordener = {
  id: 'k1', name: "Parking d'Ordener", places: 231, regime: 'GRATUIT', charging: 'EXISTANTE',
  chargingPoints: 4, pmrPlaces: 6, note: 'Proche de la rivière',
  geometry: { type: 'GeometryCollection', geometries: [point(2.583, 49.201)] },
};

describe('Carte', () => {
  it('infobulle : places, régime en toutes lettres, PMR, recharge, remarque', () => {
    expect(parkingDetails(ordener)).toEqual([
      '231 places', 'Gratuit', '6 places PMR', '⚡ Bornes installées (4)', 'Proche de la rivière',
    ]);
  });

  it('un renseignement manquant le dit ; un régime inconnu est « à préciser »', () => {
    expect(parkingDetails({ name: 'X', charging: 'AUCUNE' })).toEqual(['Nombre de places : non renseigné', 'Régime à préciser']);
    expect(regimeMeta(null).label).toBe('Régime à préciser');
  });

  it('un repère par point, une ligne par trait — en [latitude, longitude] pour Leaflet', () => {
    const stade = {
      id: 'k2', name: 'Parking du Stade', regime: 'GRATUIT', charging: 'AUCUNE',
      geometry: { type: 'GeometryCollection', geometries: [point(2.578, 49.2098), point(2.5795, 49.2104), RUE] },
    };
    const { points, lines } = parkingShapes([ordener, stade, { id: 'k3', name: 'Pas placé', geometry: null }]);
    expect(points.map((p) => [p.label, p.lat, p.lng])).toEqual([
      ["Parking d'Ordener", 49.201, 2.583], ['Parking du Stade', 49.2098, 2.578], ['Parking du Stade', 49.2104, 2.5795],
    ]);
    expect(new Set(points.map((p) => p.id)).size).toBe(3); // clés distinctes
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ parkingId: 'k2', label: 'Parking du Stade', positions: [[49.2061, 2.5862], [49.2058, 2.5871]] });
  });

  it('chaque régime a sa lettre (la couleur n’est jamais seule)', () => {
    const letters = Object.values(PARKING_REGIMES).map((r) => r.letter);
    expect(new Set(letters).size).toBe(letters.length);
  });
});

describe('Emplacements', () => {
  it('conversions GeoJSON ⇄ Leaflet, arrondi à 6 décimales', () => {
    expect(toLatLng([2.58, 49.2])).toEqual([49.2, 2.58]);
    expect(toPosition({ lat: 49.20612345678, lng: 2.58623456789 })).toEqual([2.586235, 49.206123]);
  });

  it('longueur d’un trait en mètres (≈ 75 m pour ces deux points de rue)', () => {
    expect(lineLength(RUE.coordinates)).toBeGreaterThan(65);
    expect(lineLength(RUE.coordinates)).toBeLessThan(85);
  });

  it('résumé : « 2 points + 1 trait », ou « à placer »', () => {
    expect(describeLocations([point(2.58, 49.2), point(2.59, 49.2), RUE])).toBe('2 points + 1 trait');
    expect(describeLocations([])).toBe('à placer');
  });
});

describe('Formulaire d’administration', () => {
  it('aller-retour fiche → formulaire → données envoyées', () => {
    expect(parkingFormToPayload(parkingToForm(ordener))).toEqual({
      name: "Parking d'Ordener", places: 231, regime: 'GRATUIT', charging: 'EXISTANTE',
      chargingPoints: 4, pmrPlaces: 6, note: 'Proche de la rivière', geometry: ordener.geometry,
    });
  });

  it('champs vides → null (« effacer ») ; « aucune » recharge efface les points ; aucun emplacement → geometry null', () => {
    const payload = parkingFormToPayload({ ...EMPTY_PARKING_FORM, name: ' Nouveau ', chargingPoints: '3' });
    expect(payload).toEqual({
      name: 'Nouveau', places: null, regime: null, charging: 'AUCUNE', chargingPoints: null, pmrPlaces: null, note: null, geometry: null,
    });
  });

  it('coordonnées tapées : virgule acceptée ; null si l’une est illisible', () => {
    expect(parseLatLng('49,2066', ' 2.5866 ')).toEqual({ lat: 49.2066, lng: 2.5866 });
    expect(parseLatLng('49.2066', '')).toBeNull();
    expect(parseLatLng('49,2a', '2.58')).toBeNull();
  });
});
