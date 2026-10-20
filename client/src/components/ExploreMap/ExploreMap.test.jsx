// ══════════════════════════════════════════════════════════
// Tests — carte « Explorer » (S5R-11, v2 après les retours du 07/10)
// La carte (Leaflet) est remplacée par un faux qui garde ses props :
// on peut « cliquer un quartier » comme sur la vraie.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mapProps = {};
vi.mock('../MapView/LazyMapView.jsx', () => ({
  default: (props) => { Object.assign(mapProps, props); return <div data-testid="map" />; },
}));
vi.mock('../../utils/irisData.js', () => ({
  loadIris: () => Promise.resolve({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { code_iris: '606120101' }, geometry: { type: 'Polygon', coordinates: [[[2.58, 49.2], [2.59, 49.2], [2.59, 49.21], [2.58, 49.21]]] } }],
  }),
}));
// S5R2-05 : parkings gérés par l'administration (API)
vi.mock('../../utils/parkings.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadParkings: () => Promise.resolve([
    { id: 'k1', name: 'Parking de la Gare', places: 50, regime: 'GARE', charging: 'EXISTANTE', lat: 49.2, lng: 2.58 },
  ]),
}));
vi.mock('../../services/api.js', () => ({
  api: {
    get: vi.fn((url) => Promise.resolve({
      items: url.startsWith('/proposals')
        // Plus de point précis : placée au centre de son quartier
        ? [{ id: 'p1', slug: 'pieton', title: 'Piétonnisation', zoneQuartiers: ['CENTRE_HISTORIQUE'] }]
        : [{ id: 's1', slug: 'stationnement', title: 'Stationnement', audience: { situations: [], quartiers: [], workQuartiers: [], workTypes: [] } }],
    })),
  },
}));

const { default: ExploreMap } = await import('./ExploreMap.jsx');
const { api } = await import('../../services/api.js');

async function renderMap() {
  render(<MemoryRouter><ExploreMap /></MemoryRouter>);
  await screen.findByTestId('map');
}

describe('Carte « Explorer » v2', () => {
  it('ne charge que ce qui est en cours : propositions publiées, enquêtes ouvertes', async () => {
    await renderMap();
    expect(api.get).toHaveBeenCalledWith('/proposals?status=PUBLISHED&limit=50');
    expect(api.get).toHaveBeenCalledWith('/surveys?status=OPEN&limit=50');
  });

  it('par défaut : TOUTE LA VILLE, aucun quartier mis en valeur, tous les éléments listés', async () => {
    await renderMap();
    expect(screen.getByRole('checkbox', { name: 'Toute la ville' })).toBeChecked();
    expect(mapProps.selectedQuartiers).toEqual([]);
    expect(mapProps.neutralIris).toBe(true); // plus de centre doré « par défaut »
    expect(screen.getByRole('link', { name: 'Piétonnisation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stationnement' })).toBeInTheDocument();
  });

  it('propositions ET enquêtes sur la carte, même sans point précis', async () => {
    await renderMap();
    const kinds = mapProps.markers.map((m) => m.kind).sort();
    expect(kinds).toEqual(['proposal', 'survey']);
    expect(mapProps.markers.find((m) => m.kind === 'survey').label).toMatch(/toute la ville/);
  });

  it('plusieurs quartiers : cases à cocher et clics sur la carte s’additionnent', async () => {
    await renderMap();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Villevert' }));
    act(() => mapProps.onQuartierClick('CENTRE_HISTORIQUE')); // clic sur le centre historique (S5R2-06 : par quartier)
    expect(screen.getByRole('checkbox', { name: 'Villevert' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Centre historique' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Toute la ville' })).not.toBeChecked();
    expect(mapProps.selectedQuartiers).toEqual(['VILLEVERT', 'CENTRE_HISTORIQUE']);

    // Revenir à toute la ville
    fireEvent.click(screen.getByRole('checkbox', { name: 'Toute la ville' }));
    expect(mapProps.selectedQuartiers).toEqual([]);
  });

  it('parkings : couche décochée par défaut ; une fois cochée, repères de l’administration et légende des tarifs', async () => {
    await renderMap();
    const box = screen.getByRole('checkbox', { name: /Parkings \(1\)/ });
    expect(box).not.toBeChecked();
    expect(mapProps.parkings).toEqual([]);
    expect(screen.queryByRole('heading', { name: 'Légende des parkings' })).toBeNull();

    fireEvent.click(box);
    expect(mapProps.parkings[0]).toMatchObject({ label: 'Parking de la Gare', regime: 'GARE', charging: 'EXISTANTE' });
    expect(mapProps.parkings[0].details).toContain('50 places');
    expect(screen.getByRole('heading', { name: 'Légende des parkings' })).toBeInTheDocument();
    expect(screen.getByText(/seuls les tarifs affichés sur place font foi/)).toBeInTheDocument();
  });

  it('propose le plein écran', async () => {
    await renderMap();
    expect(screen.getByRole('button', { name: '⛶ Plein écran' })).toBeInTheDocument();
  });
});
