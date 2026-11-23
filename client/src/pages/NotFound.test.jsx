// Tests — page 404, le cerf perdu dans la forêt (S5R2-10)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NotFound, { SIGNPOST } from './NotFound.jsx';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotFound', () => {
  it('un titre clair, et l\'adresse qui ne mène nulle part', () => {
    renderAt('/propositons/pietonisation'); // la faute de frappe, bien visible
    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeInTheDocument();
    expect(screen.getByText('/propositons/pietonisation')).toBeInTheDocument();
    expect(document.title).toMatch(/^Page introuvable/);
  });

  it('un panneau indicateur vers les pages utiles', () => {
    renderAt('/nulle-part');
    const nav = screen.getByRole('navigation', { name: 'Retrouver son chemin' });
    const links = [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(SIGNPOST.map((s) => s.to));
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/');
  });

  it('le cerf est perplexe (pas de message culpabilisant) et la forêt reste décorative', () => {
    const { container } = renderAt('/nulle-part');
    expect(screen.getByText('Oups, je me suis perdu dans la forêt…')).toBeInTheDocument();
    expect(container.querySelector('.mascot-question')).not.toBeNull();
    expect(container.querySelector('.lost-trees')).toHaveAttribute('aria-hidden', 'true');
  });

  it('demande aux moteurs de recherche de ne pas indexer la page, le temps qu\'elle est affichée', () => {
    const { unmount } = renderAt('/nulle-part');
    expect(document.head.querySelector('meta[name="robots"][content="noindex"]')).not.toBeNull();
    unmount();
    expect(document.head.querySelector('meta[name="robots"][content="noindex"]')).toBeNull();
  });
});
