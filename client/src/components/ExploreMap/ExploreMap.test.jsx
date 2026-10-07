// ══════════════════════════════════════════════════════════
// Tests — carte « Explorer » (S5R-11)
// La carte (Leaflet) est remplacée par un faux qui garde ses props :
// on peut ainsi « cliquer un quartier » comme le ferait la vraie.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mapProps = {};
vi.mock('../MapView/LazyMapView.jsx', () => ({
  default: (props) => { Object.assign(mapProps, props); return <div data-testid="map" />; },
}));
vi.mock('../../utils/irisData.js', () => ({ loadIris: () => Promise.resolve({ type: 'FeatureCollection', features: [] }) }));
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
        ? [{ id: 'p1', slug: 'pieton', title: 'Piétonnisation', zoneQuartiers: ['CENTRE_HISTORIQUE'], lat: 49.2, lng: 2.58 }]
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

describe('Carte « Explorer »', () => {
  it('ne charge que ce qui est en cours : propositions publiées, enquêtes ouvertes', async () => {
    await renderMap();
    expect(api.get).toHaveBeenCalledWith('/proposals?status=PUBLISHED&limit=50');
    expect(api.get).toHaveBeenCalledWith('/surveys?status=OPEN&limit=50');
  });

  it('liste les enquêtes ET les propositions du quartier choisi', async () => {
    await renderMap();
    expect(screen.getByRole('link', { name: 'Stationnement' })).toHaveAttribute('href', '/enquetes/stationnement');
    expect(screen.getByRole('link', { name: 'Piétonnisation' })).toBeInTheDocument();
    expect(screen.getByText(/toute la ville/)).toBeInTheDocument(); // l'enquête vise tout le monde

    fireEvent.change(screen.getByLabelText('Quartier'), { target: { value: 'VILLEVERT' } });
    expect(screen.queryByRole('link', { name: 'Piétonnisation' })).toBeNull();
    expect(screen.getByText('Aucune proposition pour ce quartier.')).toBeInTheDocument();
  });

  it('cliquer un quartier sur la carte le sélectionne dans la liste', async () => {
    await renderMap();
    act(() => mapProps.onIrisClick('606120201')); // code IRIS de Villevert
    expect(screen.getByLabelText('Quartier')).toHaveValue('VILLEVERT');
    expect(mapProps.selectedIris).toBe('606120201');
  });

  it('affiche les vrais parkings, avec la source OpenStreetMap', async () => {
    await renderMap();
    expect(screen.getByRole('checkbox', { name: /Parkings \(1\)/ })).toBeChecked();
    expect(mapProps.parkings[0].label).toBe('Gare — 50 places, payant');
    expect(screen.getByText(/licence ODbL/)).toBeInTheDocument();
  });
});
