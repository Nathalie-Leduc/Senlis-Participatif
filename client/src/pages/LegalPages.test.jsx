// ══════════════════════════════════════════════════════════
// Tests — Pages légales exactes (S5A-04)
//
// Deux familles de vérifications :
//  1. le contenu affiché : plus de placeholder, les mentions
//     obligatoires sont présentes, les erreurs corrigées ne
//     reviennent pas (base légale 6.1.e, « dernière connexion »…) ;
//  2. la CONCORDANCE avec le code : toute donnée que l'application
//     enregistre dans le navigateur doit être déclarée dans la
//     politique, et inversement. C'est le test qui empêchera la
//     politique de redevenir fausse sans que personne ne le voie.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import MentionsLegales from './MentionsLegales.jsx';
import PolitiqueConfidentialite from './PolitiqueConfidentialite.jsx';
import { BROWSER_STORAGE, CONTACT_EMAIL, HOST, RECIPIENTS } from '../constants/legal.js';

function renderPage(Page) {
  return render(<MemoryRouter><Page /></MemoryRouter>);
}

// Un placeholder oublié ressemble à « [Adresse postale] » ou « [durée] »
const PLACEHOLDER = /\[[^\]]+\]/;

describe('Mentions légales', () => {
  it("ne contient plus aucun placeholder entre crochets", () => {
    const { container } = renderPage(MentionsLegales);
    expect(container.textContent).not.toMatch(PLACEHOLDER);
  });

  it("affiche l'hébergeur complet (nom, adresse, téléphone) — obligation LCEN", () => {
    renderPage(MentionsLegales);
    const text = document.body.textContent;
    expect(text).toContain(HOST.name);
    expect(text).toContain(HOST.address);
    expect(text).toContain(HOST.phone);
  });

  it('propose une adresse de contact cliquable', () => {
    renderPage(MentionsLegales);
    const links = screen.getAllByRole('link', { name: CONTACT_EMAIL });
    expect(links[0]).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
  });
});

describe('Politique de confidentialité', () => {
  it('ne contient plus aucun placeholder entre crochets', () => {
    const { container } = renderPage(PolitiqueConfidentialite);
    expect(container.textContent).not.toMatch(PLACEHOLDER);
  });

  it("n'invoque plus l'art. 6.1.e (réservé aux autorités publiques) et cite bien 6.1.b et 6.1.f", () => {
    const { container } = renderPage(PolitiqueConfidentialite);
    expect(container.textContent).not.toMatch(/6\.1\.e/);
    expect(container.textContent).toMatch(/6\.1\.b/);
    expect(container.textContent).toMatch(/6\.1\.f/);
  });

  it("ne décrit pas une donnée qui n'existe pas (« dernière connexion » n'est pas stockée)", () => {
    const { container } = renderPage(PolitiqueConfidentialite);
    expect(container.textContent).not.toMatch(/dernière connexion/i);
  });

  it('mentionne le profil déclaré (résidence et travail), collecté à l\'inscription', () => {
    const { container } = renderPage(PolitiqueConfidentialite);
    expect(container.textContent).toMatch(/Profil déclaré/);
    expect(container.textContent).toMatch(/quartier de travail/);
  });

  it('liste chaque destinataire des données', () => {
    const { container } = renderPage(PolitiqueConfidentialite);
    for (const recipient of RECIPIENTS) expect(container.textContent).toContain(recipient.name);
  });

  it('donne le lien de réclamation CNIL (mention obligatoire, RGPD art. 13.2.d), signalé comme ouvrant un nouvel onglet', () => {
    renderPage(PolitiqueConfidentialite);
    const link = screen.getByRole('link', { name: /cnil\.fr\/fr\/plaintes/ });
    expect(link).toHaveAttribute('href', 'https://www.cnil.fr/fr/plaintes');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent(/nouvel onglet/);
  });

  it('présente ses tableaux avec des en-têtes de colonnes (accessibilité)', () => {
    renderPage(PolitiqueConfidentialite);
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
  });
});

// ── Concordance politique ↔ code ─────────────────────────
// On parcourt le code source du client et on relève toutes les clés
// écrites dans localStorage / sessionStorage, qu'elles soient écrites
// en toutes lettres — setItem('token', …) — ou via une constante —
// setItem(STORAGE_KEY, …) avec const STORAGE_KEY = '…' dans le fichier.

const SRC_DIR = path.join(process.cwd(), 'src');

function listSourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [full] : [];
  });
}

function storageKeysUsedInCode() {
  const keys = new Set();
  for (const file of listSourceFiles(SRC_DIR)) {
    const code = readFileSync(file, 'utf8');
    for (const [, storage, arg] of code.matchAll(/(localStorage|sessionStorage)\.setItem\(\s*([^,]+),/g)) {
      const literal = arg.match(/^['"`]([^'"`]+)['"`]$/);
      if (literal) {
        keys.add(`${storage}:${literal[1]}`);
        continue;
      }
      // Une constante : on cherche sa valeur dans le même fichier
      const constant = code.match(new RegExp(`const ${arg.trim()}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`));
      keys.add(`${storage}:${constant ? constant[1] : `<clé non résolue : ${arg.trim()}>`}`);
    }
  }
  return [...keys].sort();
}

describe('Concordance entre la politique et le code', () => {
  it('chaque donnée enregistrée dans le navigateur par le code est déclarée dans la politique — et réciproquement', () => {
    const declared = BROWSER_STORAGE.map((s) => `${s.storage}:${s.key}`).sort();
    // En cas d'échec : ajoute (ou retire) l'entrée correspondante dans
    // BROWSER_STORAGE (constants/legal.js) — la politique se met à jour seule.
    expect(storageKeysUsedInCode()).toEqual(declared);
  });

  it("aucun cookie n'est posé par le code (la politique affirme qu'il n'y en a pas)", () => {
    const offenders = listSourceFiles(SRC_DIR)
      .filter((file) => /document\.cookie\s*=/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});
