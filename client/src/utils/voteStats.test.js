import { describe, it, expect } from 'vitest';
import { votePercentages, segmentLabel } from './voteStats.js';

describe('votePercentages', () => {
  it('arrondit au dixième', () => {
    expect(votePercentages({ POUR: 2, CONTRE: 1, NEUTRE: 0 })).toEqual({ POUR: 66.7, CONTRE: 33.3, NEUTRE: 0 });
  });

  it('renvoie 0 partout sans aucun vote (pas de NaN)', () => {
    expect(votePercentages({ POUR: 0, CONTRE: 0, NEUTRE: 0 })).toEqual({ POUR: 0, CONTRE: 0, NEUTRE: 0 });
  });
});

describe('segmentLabel', () => {
  it('traduit une valeur connue', () => {
    expect(segmentLabel('situation', 'HORS_SENLIS')).toBe('Hors Senlis');
    expect(segmentLabel('travailleQuartier', 'CENTRE_HISTORIQUE')).toBe('Centre historique');
  });

  it("donne à la valeur vide le sens propre à chaque axe", () => {
    expect(segmentLabel('situation', null)).toBe('Non renseignée');
    expect(segmentLabel('travailType', null)).toMatch(/Ne travaille pas à Senlis/);
  });

  it('affiche brute une valeur inconnue plutôt que de planter', () => {
    expect(segmentLabel('quartier', 'NOUVEAU_QUARTIER')).toBe('NOUVEAU_QUARTIER');
  });
});
