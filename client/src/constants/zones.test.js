import { describe, it, expect } from 'vitest';
import { describeZone, zoneFeatures, quartierOfFeature, ZONE_QUARTIERS } from './zones.js';

// Fichier découpé (S5R2-06) : chaque contour porte son quartier
const iris = { type: 'FeatureCollection', features: ZONE_QUARTIERS.map((q) => ({ type: 'Feature', properties: { code_iris: q.codeIris, quartier: q.value }, geometry: null })) };

describe('zone d’une proposition', () => {
  it('se décrit en français', () => {
    expect(describeZone({ zoneWholeCity: true })).toBe('Toute la ville');
    expect(describeZone({ zoneQuartiers: ['CENTRE_HISTORIQUE', 'BRICHEBAY'] })).toBe('Centre historique et Brichebay');
    expect(describeZone({ zoneQuartiers: [] })).toBeNull();
  });

  it('ne garde que les contours des quartiers concernés (tous pour la ville)', () => {
    expect(zoneFeatures(iris, { zoneQuartiers: ['VILLEVERT'] }).features).toHaveLength(1);
    expect(zoneFeatures(iris, { zoneWholeCity: true }).features).toHaveLength(8);
    expect(zoneFeatures(iris, { zoneQuartiers: [] })).toBeNull();
  });

  it('S5R2-06 : Saint-Vincent a son propre contour, distinct du Centre historique (même code IRIS)', () => {
    const [sv] = zoneFeatures(iris, { zoneQuartiers: ['SAINT_VINCENT'] }).features;
    expect(sv.properties.quartier).toBe('SAINT_VINCENT');
    expect(describeZone({ zoneQuartiers: ['SAINT_VINCENT'] })).toBe('Quartier Saint-Vincent');
  });

  it('quartierOfFeature : le quartier écrit dans le fichier, sinon celui du code IRIS', () => {
    expect(quartierOfFeature({ properties: { code_iris: '606120101', quartier: 'SAINT_VINCENT' } })).toBe('SAINT_VINCENT');
    // Ancien fichier non découpé : tout le « Centre Ville » = Centre historique
    expect(quartierOfFeature({ properties: { code_iris: '606120101' } })).toBe('CENTRE_HISTORIQUE');
    expect(quartierOfFeature({ properties: { code_iris: '606120201' } })).toBe('VILLEVERT');
    expect(quartierOfFeature({})).toBeUndefined();
  });
});
