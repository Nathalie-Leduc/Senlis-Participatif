// ══════════════════════════════════════════════════════════
// Tests — réglages d'Argon2 : légers en test, JAMAIS ailleurs
// (S5R2-08, recette du 25/11)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import argon2 from 'argon2';
import { argon2Options } from '../src/lib/argon2Options.js';

describe('argon2Options', () => {
  it('production et développement : paramètres par défaut (protection complète)', async () => {
    expect(argon2Options('production')).toEqual({});
    expect(argon2Options('development')).toEqual({});
    expect(argon2Options('')).toEqual({}); // NODE_ENV absent

    // Et ces défauts sont bien forts : argon2id, 64 Mio, 3 passes
    const hash = await argon2.hash('une phrase de passe assez longue', argon2Options('production'));
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/);
  });

  it('test : réglage léger, pour une suite rapide', () => {
    expect(argon2Options('test')).toEqual({ memoryCost: 1024, timeCost: 1, parallelism: 1 });
  });
});
