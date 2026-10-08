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
vi.mock('../../utils/osmParkings.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadParkings: () => Promise.resolve({
    type: 'FeatureCollection', source: '© contributeurs OpenStreetMap — licence ODbL',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [2.58, 49.2] }, properties: { osmId: 'node/1', name: 'Gare', capacity: 50, fee: true } }],
  }),
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
    expect(mapProps.selectedIris).toEqual([]);
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
    act(() => mapProps.onIrisClick('606120101')); // clic sur le centre historique
    expect(screen.getByRole('checkbox', { name: 'Villevert' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Centre historique' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Toute la ville' })).not.toBeChecked();
    expect(mapProps.selectedIris).toEqual(['606120201', '606120101']);

    // Revenir à toute la ville
    fireEvent.click(screen.getByRole('checkbox', { name: 'Toute la ville' }));
    expect(mapProps.selectedIris).toEqual([]);
  });

  it('parkings : couche décochée par défaut (320 repères surchargeaient la carte), source affichée une fois cochée', async () => {
    await renderMap();
    const box = screen.getByRole('checkbox', { name: /Parkings \(1\)/ });
    expect(box).not.toBeChecked();
    expect(mapProps.parkings).toEqual([]);
    fireEvent.click(box);
    expect(mapProps.parkings[0].label).toBe('Gare — 50 places, payant');
    expect(screen.getByText(/licence ODbL/)).toBeInTheDocument();
  });

  it('propose le plein écran', async () => {
    await renderMap();
    expect(screen.getByRole('button', { name: '⛶ Plein écran' })).toBeInTheDocument();
  });
});
