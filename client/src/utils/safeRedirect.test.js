import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './safeRedirect.js';

describe('safeRedirectPath', () => {
  it('garde un chemin interne, avec sa requête et son ancre', () => {
    expect(safeRedirectPath('/propositions/pietonnisation?vote=POUR#votes')).toBe('/propositions/pietonnisation?vote=POUR#votes');
  });

  it("renvoie à l'accueil pour toute adresse qui sortirait du site", () => {
    for (const bad of ['//pirate.fr', '/\\pirate.fr', 'https://pirate.fr', 'pirate.fr', 'javascript:alert(1)', '', null]) {
      expect(safeRedirectPath(bad)).toBe('/');
    }
  });
});
