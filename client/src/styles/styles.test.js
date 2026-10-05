// ══════════════════════════════════════════════════════════
// Garde-fou — les feuilles de style compilent (S5R-03)
//
// ESLint ne lit pas le SCSS : une accolade en trop n'était détectée
// qu'au `npm run build` (cas réel pendant S5R-03). Ce test compile la
// feuille principale — et donc toutes les partielles qu'elle importe —
// avec le même compilateur Sass que Vite.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import * as sass from 'sass';
import path from 'node:path';
import process from 'node:process';

describe('Feuilles de style', () => {
  it('global.scss et toutes ses partielles compilent sans erreur', () => {
    const file = path.join(process.cwd(), 'src/styles/global.scss');
    const { css } = sass.compile(file, { silenceDeprecations: ['import'] });
    expect(css.length).toBeGreaterThan(0);
    // Les règles du module d'accessibilité sont bien présentes
    expect(css).toContain('.a11y-panel');
    expect(css).toContain('html.a11y-line-height');
  });
});
