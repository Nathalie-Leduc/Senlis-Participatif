// ══════════════════════════════════════════════════════════
// Tests — découpage du centre en deux quartiers (S5R2-06)
// Sur le VRAI fichier des quartiers (public/data/iris-senlis.geojson).
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { splitCentre, splitWithShape, centreGeometry, planarArea, CENTRE_IRIS } from './quartierSplit.js';
import { quartierOfFeature } from '../constants/zones.js';

const iris = JSON.parse(readFileSync(path.join(process.cwd(), 'public/data/iris-senlis.geojson'), 'utf8'));

// Un tracé (en [lat, lng], comme Leaflet) qui prend la moitié EST du
// centre et DÉBORDE largement vers l'est, comme Saint-Vincent sur le plan
const EAST_HALF = [[49.215, 2.590], [49.215, 2.620], [49.195, 2.620], [49.195, 2.590]];

describe('splitCentre', () => {
  const { file, centre, saintVincent, outsideShare } = splitCentre(iris, EAST_HALF, new Date(2026, 9, 12));

  it('8 quartiers : les 6 autres inchangés, le centre en deux', () => {
    expect(file.features).toHaveLength(8);
    expect(file.features.map(quartierOfFeature).sort()).toEqual([
      'BON_SECOURS', 'BRICHEBAY', 'CENTRE_HISTORIQUE', 'JARDINIERS', 'SAINT_VINCENT',
      'VAL_AUNETTE_GATELIERE', 'VILLEVERT', 'ZONE_INDUSTRIELLE',
    ]);
    const before = iris.features.find((f) => f.properties.code_iris === '606120201');
    const after = file.features.find((f) => f.properties.code_iris === '606120201');
    expect(after.geometry).toEqual(before.geometry); // Villevert : pas un sommet ne bouge
  });

  it('les deux moitiés recouvrent exactement le centre INSEE (rien de perdu, rien en trop)', () => {
    const total = planarArea(centreGeometry(iris));
    const parts = planarArea(centre.geometry.coordinates) + planarArea(saintVincent.geometry.coordinates);
    expect(parts / total).toBeCloseTo(1, 4);
    expect(planarArea(saintVincent.geometry.coordinates)).toBeLessThan(total);
  });

  it('le débordement hors du centre est ignoré, et mesuré pour prévenir', () => {
    expect(outsideShare).toBeGreaterThan(0.5);
    expect(outsideShare).toBeLessThan(1);
  });

  it('chaque moitié dit d’où elle vient', () => {
    expect(saintVincent.properties).toMatchObject({ code_iris: CENTRE_IRIS, quartier: 'SAINT_VINCENT', nom: 'Quartier Saint-Vincent' });
    expect(centre.properties.source).toMatch(/plan municipal de 2018.*12\/10\/2026/);
  });

  it('on peut retracer à partir d’un fichier déjà découpé : on recolle d’abord le centre', () => {
    const again = splitCentre(file, EAST_HALF);
    expect(again.file.features).toHaveLength(8);
    expect(planarArea(again.saintVincent.geometry.coordinates))
      .toBeCloseTo(planarArea(saintVincent.geometry.coordinates), 10);
  });
});

describe('splitCentre — tracés impossibles', () => {
  it('moins de 3 points', () => {
    expect(() => splitCentre(iris, [[49.2, 2.59], [49.21, 2.59]])).toThrow(/au moins 3 points/);
  });
  it('un tracé loin du centre : Saint-Vincent serait vide', () => {
    expect(() => splitCentre(iris, [[49.25, 2.55], [49.25, 2.56], [49.24, 2.56]])).toThrow(/ne touche pas le centre/);
  });
  it('un tracé qui englobe tout le centre : plus de Centre historique', () => {
    expect(() => splitCentre(iris, [[49.25, 2.55], [49.25, 2.65], [49.15, 2.65], [49.15, 2.55]])).toThrow(/il ne resterait rien/);
  });
});

// ── S5R-13 : mise à jour des contours INSEE (scripts/update-iris.mjs) ──
describe('splitWithShape — redécouper un centre tout neuf avec la forme actuelle de Saint-Vincent', () => {
  // Le fichier « comme l'IGN le fournit » : le centre d'un seul tenant
  const ign = {
    type: 'FeatureCollection',
    features: [
      ...iris.features.filter((f) => f.properties.code_iris !== CENTRE_IRIS),
      { type: 'Feature', properties: { code_iris: CENTRE_IRIS, nom_iris: 'Centre Ville' }, geometry: { type: 'MultiPolygon', coordinates: centreGeometry(iris) } },
    ],
  };
  const sv = iris.features.find((f) => f.properties.quartier === 'SAINT_VINCENT');
  const { file, saintVincent, outsideShare } = splitWithShape(ign, sv.geometry.coordinates, 'mise à jour de test');

  it('retrouve exactement les mêmes 8 quartiers (même surface de Saint-Vincent, rien ne déborde)', () => {
    expect(file.features.map(quartierOfFeature).sort()).toEqual(iris.features.map(quartierOfFeature).sort());
    expect(planarArea(saintVincent.geometry.coordinates)).toBeCloseTo(planarArea(sv.geometry.coordinates), 10);
    expect(outsideShare).toBeLessThan(0.001);
    expect(saintVincent.properties.source).toBe('mise à jour de test');
  });
});

