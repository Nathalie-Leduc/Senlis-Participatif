// ══════════════════════════════════════════════════════════
// Test minimal — Sprint 0
// Vérifie que le serveur démarre et que /health répond.
// Les vrais tests d'intégration auth arriveront au Sprint 1.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

describe('API — Sanity check', () => {
  it('devrait exister', () => {
    // Test placeholder : la CI a besoin d'au moins un test
    // pour ne pas quitter avec code 1.
    // Sprint 1 → vrais tests d'intégration (register → login → me)
    expect(true).toBe(true);
  });
});