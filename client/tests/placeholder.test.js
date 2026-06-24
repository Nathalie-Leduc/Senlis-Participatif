// ══════════════════════════════════════════════════════════
// Test placeholder — empêche Vitest de quitter en erreur
// quand aucun vrai test n'existe encore.
//
// Analogie : c'est le « cahier de brouillon » vide posé
// sur le bureau pour que le prof ne dise pas
// « vous n'avez pas de cahier ! » à l'appel.
//
// À supprimer dès qu'un vrai test client est écrit.
// ══════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';

describe('Client placeholder', () => {
  it('devrait confirmer que le test runner fonctionne', () => {
    expect(true).toBe(true);
  });
});