import { describe, it, expect } from 'vitest';
import { describeAudience, isEveryone, EMPTY_AUDIENCE } from './audience.js';

const a = (overrides) => ({ ...EMPTY_AUDIENCE, ...overrides });

describe('describeAudience', () => {
  it('sans critère : tout le monde', () => {
    expect(isEveryone(EMPTY_AUDIENCE)).toBe(true);
    expect(describeAudience(EMPTY_AUDIENCE)).toBe('tout le monde');
  });

  it('résidence, avec ou sans quartiers précis', () => {
    expect(describeAudience(a({ situations: ['CENTRE_RESIDENT'] }))).toBe('habitants du centre historique');
    expect(describeAudience(a({ situations: ['AUTRE_QUARTIER'] }))).toBe('habitants des autres quartiers de Senlis');
    expect(describeAudience(a({ situations: ['AUTRE_QUARTIER'], quartiers: ['BRICHEBAY', 'VILLEVERT'] })))
      .toBe('habitants de Brichebay et Villevert');
  });

  it('travail, et combinaison des deux familles', () => {
    expect(describeAudience(a({ workQuartiers: ['CENTRE_HISTORIQUE'], workTypes: ['COMMERCANT'] })))
      .toBe('personnes qui dirigent une activité dans le centre historique');
    expect(describeAudience(a({ situations: ['CENTRE_RESIDENT'], workTypes: ['SALARIE'] })))
      .toBe('habitants du centre historique et salarié·es à Senlis');
  });
});
