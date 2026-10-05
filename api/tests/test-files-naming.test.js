// ══════════════════════════════════════════════════════════
// Garde-fou — tous les fichiers de test sont-ils vraiment lancés ?
// (S5A-02)
//
// Vitest ne lance QUE les fichiers nommés *.test.js ou *.spec.js.
// Un fichier nommé users.tests.js (avec un « s ») a ainsi été
// IGNORÉ en silence pendant tout le Sprint 5bis : ses 11 tests
// n'ont jamais tourné, et la CI restait verte quand même.
//
// Analogie : un détecteur de fumée dont on a oublié la pile. Il
// ne sonne jamais… ce qui ressemble exactement à « tout va bien ».
//
// Ce test liste le dossier tests/ et échoue si un fichier .js n'est
// ni un fichier de test correctement nommé, ni un fichier d'outillage
// connu (setup.js, helpers.js).
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));

// Fichiers du dossier qui ne SONT PAS des tests, et c'est normal
const TOOLING_FILES = ['setup.js', 'helpers.js'];

describe('Nommage des fichiers de test', () => {
  it('chaque fichier .js de tests/ est lancé par Vitest (ou est un outil connu)', () => {
    const jsFiles = readdirSync(TESTS_DIR).filter((f) => f.endsWith('.js'));

    const ignoredByVitest = jsFiles.filter(
      (f) => !/\.(test|spec)\.js$/.test(f) && !TOOLING_FILES.includes(f),
    );

    // En cas d'échec, le message liste les fichiers fautifs :
    // renomme-les en <nom>.test.js
    expect(ignoredByVitest).toEqual([]);
  });
});
