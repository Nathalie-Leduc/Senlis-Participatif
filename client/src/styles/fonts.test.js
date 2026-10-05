// ══════════════════════════════════════════════════════════
// Garde-fou RGPD — aucune police chargée depuis un tiers (S5A-03)
//
// Google Fonts transmettait l'adresse IP de chaque visiteur à
// Google. On a remplacé ce chargement par des polices servies par
// notre propre serveur (voir _fonts.scss). Ce test empêche qu'un
// copier-coller de <link href="https://fonts.googleapis.com/...">,
// très courant dans les tutoriels, ne réintroduise le problème sans
// que personne ne s'en rende compte.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
// Import explicite : la config ESLint du client ne déclare pas les globales Node
import process from 'node:process';

// Les tests Vitest du client s'exécutent depuis le dossier client/
const CLIENT_DIR = process.cwd();

// Domaines qui servent des polices (et voient donc l'IP du visiteur)
const THIRD_PARTY_FONT_HOSTS = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net/;

/** Tous les fichiers source du dossier, récursivement. */
function listSourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.(jsx?|s?css|html)$/.test(name) ? [full] : [];
  });
}

describe('Polices auto-hébergées', () => {
  it("index.html ne charge aucune police depuis un serveur tiers", () => {
    const html = readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf8');
    expect(html).not.toMatch(THIRD_PARTY_FONT_HOSTS);
  });

  it('aucun fichier de src/ ne référence un serveur de polices tiers', () => {
    const offenders = listSourceFiles(path.join(CLIENT_DIR, 'src'))
      .filter((file) => !file.endsWith('fonts.test.js')) // ce fichier cite les domaines… pour les interdire
      .filter((file) => THIRD_PARTY_FONT_HOSTS.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(CLIENT_DIR, file));
    expect(offenders).toEqual([]);
  });

  it('les deux familles de la charte sont déclarées localement, sous leurs noms historiques', () => {
    const scss = readFileSync(path.join(CLIENT_DIR, 'src/styles/_fonts.scss'), 'utf8');
    expect(scss).toMatch(/font-family: 'Fraunces';/);
    expect(scss).toMatch(/font-family: 'Public Sans';/);
    // Tous les fichiers viennent des paquets npm (donc de notre serveur au build)
    const sources = [...scss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) expect(src).toMatch(/^@fontsource-variable\//);
  });
});
