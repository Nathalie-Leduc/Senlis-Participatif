// Tests — titre de page (S5A-07, RGAA 8.6)
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { usePageTitle, formatPageTitle } from './usePageTitle.js';

describe('usePageTitle', () => {
  it('compose « Titre — Senlis Participatif »', () => {
    expect(formatPageTitle('Propositions')).toBe('Propositions — Senlis Participatif');
    expect(formatPageTitle('')).toBe('Senlis Participatif');
  });

  it("met à jour le titre de l'onglet, y compris quand il change (chargement → titre réel)", () => {
    function Page({ title }) {
      usePageTitle(title);
      return null;
    }
    const { rerender } = render(<MemoryRouter><Page title="Proposition" /></MemoryRouter>);
    expect(document.title).toBe('Proposition — Senlis Participatif');

    rerender(<MemoryRouter><Page title="Piétonniser la rue de Paris" /></MemoryRouter>);
    expect(document.title).toBe('Piétonniser la rue de Paris — Senlis Participatif');
  });
});

// Garde-fou : une nouvelle page ajoutée sans titre ferait réapparaître
// le défaut « toutes les pages s'appellent pareil ».
describe('Chaque page déclare son titre', () => {
  it('tout fichier de src/pages appelle usePageTitle()', () => {
    const dir = path.join(process.cwd(), 'src/pages');
    const missing = readdirSync(dir)
      .filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))
      .filter((f) => !readFileSync(path.join(dir, f), 'utf8').includes('usePageTitle('));
    expect(missing).toEqual([]);
  });
});
