// ══════════════════════════════════════════════════════════
// Tests — module d'accessibilité, recette du 30/09 (S5R-03)
//
//  1. Bouton « Fermer » inatteignable en profil Malvoyance : le panneau
//     dépassait de l'écran à cause du zoom. On vérifie la règle CSS qui
//     compense le zoom, et la gestion du focus.
//  2. Interligne sur 4 niveaux + espacements WCAG 1.4.12.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { AccessibilityProvider, migrateSettings } from '../../contexts/AccessibilityContext.jsx';
import AccessibilityWidget from './AccessibilityWidget.jsx';

const root = document.documentElement;

function renderAndOpen() {
  render(<AccessibilityProvider><AccessibilityWidget /></AccessibilityProvider>);
  fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
}

describe('Panneau toujours utilisable (bouton Fermer atteignable)', () => {
  beforeEach(() => {
    localStorage.clear();
    root.className = '';
    root.style.cssText = '';
  });

  it("à l'ouverture, le focus va sur ✕ ; à la fermeture (Échap), il revient sur le bouton ♿", () => {
    renderAndOpen();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer le panneau' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: "Options d'accessibilité" }));
  });

  it('un second bouton « Fermer » en bas du panneau le ferme aussi', () => {
    renderAndOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la hauteur du panneau compense le zoom (sinon le haut sort de l’écran en Malvoyance)', () => {
    // jsdom ne calcule pas la mise en page : on vérifie la règle CSS
    // elle-même, garde-fou contre une régression du bug de recette.
    const scss = readFileSync(path.join(process.cwd(), 'src/styles/_accessibility.scss'), 'utf8');
    const panel = scss.slice(scss.indexOf('.a11y-panel {'), scss.indexOf('.a11y-panel-header'));
    expect(panel).toMatch(/max-height: calc\(\(100d?vh - \d+px\) \/ var\(--a11y-font-scale, 1\)\)/);
    expect(scss).toMatch(/\.a11y-panel-header \{[^}]*position: sticky/);
  });
});

describe('Interligne et espacements (WCAG 1.4.12)', () => {
  beforeEach(() => {
    localStorage.clear();
    root.className = '';
    root.style.cssText = '';
  });

  it("propose 4 niveaux d'interligne et applique la valeur choisie à toute la page", () => {
    renderAndOpen();
    const group = screen.getByRole('group', { name: 'Interligne' });
    expect(group.querySelectorAll('button')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: '1,8' }));
    expect(root).toHaveClass('a11y-line-height');
    expect(root.style.getPropertyValue('--a11y-line-height')).toBe('1.8');
    expect(screen.getByRole('button', { name: '1,8' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Standard' }));
    expect(root).not.toHaveClass('a11y-line-height');
    expect(root.style.getPropertyValue('--a11y-line-height')).toBe('');
  });

  it('active les espacements de lettres, mots et paragraphes', () => {
    renderAndOpen();
    fireEvent.click(screen.getByRole('checkbox', { name: /Espacer les lettres/ }));
    expect(root).toHaveClass('a11y-text-spacing');
  });

  it('le profil Dyslexie applique un interligne de 1,8 ET les espacements', () => {
    renderAndOpen();
    fireEvent.click(screen.getByRole('button', { name: /Dyslexie/ }));
    expect(root.style.getPropertyValue('--a11y-line-height')).toBe('1.8');
    expect(root).toHaveClass('a11y-text-spacing');
  });

  it("retrouve le réglage d'avant S5R-03 (« interligne augmenté » = 2)", () => {
    expect(migrateSettings({ lineSpacing: true, fontScale: 1.15 })).toEqual({ lineHeight: 2, fontScale: 1.15 });
    expect(migrateSettings({ lineSpacing: false })).toEqual({});

    localStorage.setItem('senlis-a11y-settings', JSON.stringify({ lineSpacing: true }));
    renderAndOpen();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
  });
});
