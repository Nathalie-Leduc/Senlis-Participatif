// ══════════════════════════════════════════════════════════
// Tests — LazyMapView : la carte n'est chargée qu'à l'approche
// (S5R2-08 partie 3, Lighthouse)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// La vraie carte (Leaflet) remplacée par un repère simple
vi.mock('./MapView.jsx', () => ({ default: () => <p>Carte chargée</p> }));

const { default: LazyMapView } = await import('./LazyMapView.jsx');

describe('LazyMapView', () => {
  afterEach(() => { delete window.IntersectionObserver; });

  it('loin de l\'écran : seulement l\'emplacement réservé, Leaflet pas téléchargé', async () => {
    let notify;
    window.IntersectionObserver = vi.fn(function IO(callback) {
      notify = callback;
      this.observe = vi.fn();
      this.disconnect = vi.fn();
    });

    render(<LazyMapView height={380} />);
    expect(screen.getByText(/Chargement de la carte/)).toBeInTheDocument();
    expect(screen.queryByText('Carte chargée')).toBeNull();

    // La personne fait défiler la page : la carte approche
    act(() => notify([{ isIntersecting: true }]));
    expect(await screen.findByText('Carte chargée')).toBeInTheDocument();
  });

  it('sans IntersectionObserver (vieux navigateur) : chargée tout de suite', async () => {
    render(<LazyMapView />);
    expect(await screen.findByText('Carte chargée')).toBeInTheDocument();
  });
});
