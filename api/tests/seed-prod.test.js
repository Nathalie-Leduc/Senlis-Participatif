// ══════════════════════════════════════════════════════════
// Test — validateAdminCredentials (seed-prod.js, S5-09/S5-10)
//
// Importer seed-prod.js ne déclenche PAS tout le seed grâce au
// garde `if (import.meta.url === ...)` en bas du fichier — sans
// ça, ce simple import essaierait de se connecter à la base et de
// créer un vrai compte admin à chaque lancement des tests.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { validateAdminCredentials } from '../prisma/seed-prod.js';

describe('validateAdminCredentials', () => {
  it('accepte un email et un mot de passe valides (12+ caractères)', () => {
    expect(validateAdminCredentials('mairie@senlis.fr', 'MotDePasseSolide2026!')).toEqual([]);
  });

  it('refuse si email et mot de passe sont tous les deux absents', () => {
    const errors = validateAdminCredentials(undefined, undefined);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("refuse si l'email est absent, même avec un bon mot de passe", () => {
    const errors = validateAdminCredentials(undefined, 'MotDePasseSolide2026!');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('refuse si le mot de passe est absent, même avec un email valide', () => {
    const errors = validateAdminCredentials('mairie@senlis.fr', undefined);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('refuse un mot de passe de moins de 12 caractères', () => {
    const errors = validateAdminCredentials('mairie@senlis.fr', 'court1234!');
    expect(errors.some((e) => e.includes('12 caractères'))).toBe(true);
  });

  it('accepte un mot de passe de exactement 12 caractères (limite incluse)', () => {
    expect(validateAdminCredentials('mairie@senlis.fr', 'A1b2C3d4E5f!')).toEqual([]);
  });
});
