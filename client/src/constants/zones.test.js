import { describe, it, expect } from 'vitest';
import { describeZone, zoneFeatures, ZONE_QUARTIERS } from './zones.js';

const iris = { type: 'FeatureCollection', features: ZONE_QUARTIERS.map((q) => ({ type: 'Feature', properties: { code_iris: q.codeIris }, geometry: null })) };

describe('zone d’une proposition', () => {
  it('se décrit en français', () => {
    expect(describeZone({ zoneWholeCity: true })).toBe('Toute la ville');
    expect(describeZone({ zoneQuartiers: ['CENTRE_HISTORIQUE', 'BRICHEBAY'] })).toBe('Centre historique et Brichebay');
    expect(describeZone({ zoneQuartiers: [] })).toBeNull();
  });

  it('ne garde que les contours des quartiers concernés (tous pour la ville)', () => {
    expect(zoneFeatures(iris, { zoneQuartiers: ['VILLEVERT'] }).features).toHaveLength(1);
    expect(zoneFeatures(iris, { zoneWholeCity: true }).features).toHaveLength(7);
    expect(zoneFeatures(iris, { zoneQuartiers: [] })).toBeNull();
  });
});
