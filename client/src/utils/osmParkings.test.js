import { describe, it, expect } from 'vitest';
import { overpassToGeoJson, parkingMarkers, parkingLabel } from './osmParkings.js';

const overpass = {
  elements: [
    { type: 'node', id: 1, lat: 49.2, lon: 2.58, tags: { amenity: 'parking', name: 'Parking de la gare', capacity: '120', fee: 'yes' } },
    // Dessiné comme une surface : réduit à son centre
    { type: 'way', id: 2, center: { lat: 49.21, lon: 2.59 }, tags: { amenity: 'parking', fee: 'no', parking: 'underground' } },
    // Privé : jamais affiché
    { type: 'way', id: 3, center: { lat: 49.22, lon: 2.6 }, tags: { amenity: 'parking', access: 'private' } },
    // Pas un parking
    { type: 'node', id: 4, lat: 49.2, lon: 2.58, tags: { amenity: 'bench' } },
  ],
};

describe('parkings OpenStreetMap', () => {
  it("garde les parkings publics, au bon format GeoJSON (longitude d'abord), avec la source", () => {
    const fc = overpassToGeoJson(overpass, '2026-10-06T00:00:00Z');
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry.coordinates).toEqual([2.58, 49.2]);
    expect(fc.features[1].properties).toMatchObject({ osmId: 'way/2', fee: false, kind: 'underground' });
    expect(fc.source).toMatch(/OpenStreetMap — licence ODbL/);
  });

  it('libellés et repères pour la carte', () => {
    expect(parkingLabel({ name: 'Parking de la gare', capacity: 120, fee: true })).toBe('Parking de la gare — 120 places, payant');
    expect(parkingLabel({ name: null, capacity: null, fee: false, kind: 'underground' })).toBe('Parking — gratuit, souterrain');
    const [marker] = parkingMarkers(overpassToGeoJson(overpass));
    expect(marker).toMatchObject({ id: 'node/1', lat: 49.2, lng: 2.58 });
  });
});
