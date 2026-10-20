// ══════════════════════════════════════════════════════════
// Tests — parkings gérés par l'administration (S5R2-05) : mise en
// forme pour la carte et formulaire de l'écran d'administration
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { parkingDetails, parkingMarkers, parkingToForm, parkingFormToPayload, formPosition, EMPTY_PARKING_FORM } from './parkings.js';
import { PARKING_REGIMES, regimeMeta } from '../constants/parkings.js';

const ordener = {
  id: 'k1', name: "Parking d'Ordener", places: 231, regime: 'GRATUIT', charging: 'EXISTANTE',
  chargingPoints: 4, pmrPlaces: 6, note: 'Proche de la rivière', lat: 49.201, lng: 2.583,
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

  it('seuls les parkings placés deviennent des repères', () => {
    const markers = parkingMarkers([ordener, { id: 'k2', name: 'Pas placé', lat: null, lng: null }]);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 'k1', label: "Parking d'Ordener", regime: 'GRATUIT', charging: 'EXISTANTE' });
  });

  it('chaque régime a sa lettre (la couleur n’est jamais seule)', () => {
    const letters = Object.values(PARKING_REGIMES).map((r) => r.letter);
    expect(new Set(letters).size).toBe(letters.length);
  });
});

describe('Formulaire d’administration', () => {
  it('aller-retour fiche → formulaire → données envoyées', () => {
    expect(parkingFormToPayload(parkingToForm(ordener))).toEqual({
      name: "Parking d'Ordener", places: 231, regime: 'GRATUIT', charging: 'EXISTANTE',
      chargingPoints: 4, pmrPlaces: 6, note: 'Proche de la rivière', lat: 49.201, lng: 2.583,
    });
  });

  it('champs vides → null (« effacer ») ; « aucune » recharge efface les points', () => {
    const payload = parkingFormToPayload({ ...EMPTY_PARKING_FORM, name: ' Nouveau ', chargingPoints: '3' });
    expect(payload).toEqual({
      name: 'Nouveau', places: null, regime: null, charging: 'AUCUNE', chargingPoints: null, pmrPlaces: null, note: null, lat: null, lng: null,
    });
  });

  it('coordonnées : virgule acceptée ; position seulement si les deux sont des nombres', () => {
    expect(formPosition({ lat: '49,2066', lng: ' 2.5866 ' })).toEqual({ lat: 49.2066, lng: 2.5866 });
    expect(formPosition({ lat: '49.2066', lng: '' })).toBeNull();
    expect(formPosition({ lat: '49,2a', lng: '2.58' })).toBeNull();
  });
});
