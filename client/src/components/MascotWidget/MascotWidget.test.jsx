// ══════════════════════════════════════════════════════════
// Tests — guide « Cerf-tifié utile ! » (S5R-04)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import MascotWidget from './MascotWidget.jsx';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Link to="/enquetes">Aller aux enquêtes</Link>
      <Routes><Route path="*" element={null} /></Routes>
      <MascotWidget />
    </MemoryRouter>,
  );
}

const openGuide = () => fireEvent.click(screen.getByRole('button', { name: 'Guide citoyen' }));

describe('Guide « Cerf-tifié utile ! »', () => {
  it("est un bouton (et non plus un 2e cerf avec sa bulle) : rien n'est affiché avant le clic", () => {
    renderAt('/');
    const toggle = screen.getByRole('button', { name: 'Guide citoyen' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Découvrez le site/)).toBeNull();
  });

  it("s'ouvre avec le titre de la maquette, une astuce propre à la page, et place le focus dans le panneau", () => {
    renderAt('/propositions');
    openGuide();
    expect(screen.getByRole('dialog', { name: /Cerf-tifié utile/ })).toBeInTheDocument();
    expect(screen.getByText(/Choisissez une proposition/)).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer le guide' }));
  });

  it('une question fréquente ajoute la question et la réponse du cerf', () => {
    renderAt('/');
    openGuide();
    fireEvent.click(screen.getByRole('button', { name: 'Mes données ?' }));
    expect(screen.getAllByText('Mes données ?')).toHaveLength(2); // le bouton + la bulle de question
    expect(screen.getByText(/jamais publiés individuellement/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'En savoir plus' })).toHaveAttribute('href', '/confidentialite');
  });

  it('la pastille « 1 » disparaît après la première ouverture', () => {
    renderAt('/');
    const toggle = screen.getByRole('button', { name: 'Guide citoyen' });
    expect(toggle).toHaveClass('guide-toggle--new');
    openGuide();
    expect(toggle).not.toHaveClass('guide-toggle--new');
  });

  it('Échap ferme le guide et rend le focus au bouton', () => {
    renderAt('/');
    openGuide();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Guide citoyen' }));
  });

  it('changer de page referme le guide', () => {
    renderAt('/');
    openGuide();
    fireEvent.click(screen.getByRole('link', { name: 'Aller aux enquêtes' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
