// Tests — annonce des changements de page (S5A-07)
import { describe, it, expect, beforeEach } from 'vitest';
import { announcePageChange, resetRouteAnnouncer, ANNOUNCER_ID } from './routeAnnouncer.js';

describe('announcePageChange', () => {
  beforeEach(() => {
    resetRouteAnnouncer();
    document.body.innerHTML = `
      <div id="${ANNOUNCER_ID}" aria-live="polite"></div>
      <main id="main"><h1>Propositions</h1><a href="#">lien</a></main>`;
  });

  it("n'annonce rien au tout premier chargement (le navigateur lit déjà la page)", () => {
    announcePageChange('/', 'Accueil — Senlis Participatif');
    expect(document.getElementById(ANNOUNCER_ID).textContent).toBe('');
    expect(document.activeElement).toBe(document.body);
  });

  it('annonce le titre et place le focus sur le <h1> au changement de page', () => {
    announcePageChange('/', 'Accueil — Senlis Participatif');
    announcePageChange('/propositions', 'Propositions — Senlis Participatif');

    expect(document.getElementById(ANNOUNCER_ID).textContent).toBe('Page chargée : Propositions — Senlis Participatif');
    const h1 = document.querySelector('h1');
    expect(document.activeElement).toBe(h1);
    // focalisable par le code, sans entrer dans l'ordre de tabulation
    expect(h1.getAttribute('tabindex')).toBe('-1');
  });

  it("n'annonce pas deux fois la même page (ex. titre provisoire puis titre réel)", () => {
    announcePageChange('/', 'Accueil — Senlis Participatif');
    announcePageChange('/propositions/abc', 'Proposition — Senlis Participatif');
    announcePageChange('/propositions/abc', 'Piétonniser la rue de Paris — Senlis Participatif');
    expect(document.getElementById(ANNOUNCER_ID).textContent).toBe('Page chargée : Proposition — Senlis Participatif');
  });

  it("se rabat sur la zone principale si la page n'a pas (encore) de <h1>", () => {
    document.querySelector('h1').remove();
    announcePageChange('/', 'A');
    announcePageChange('/b', 'B');
    expect(document.activeElement).toBe(document.getElementById('main'));
  });
});
