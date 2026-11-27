// ══════════════════════════════════════════════════════════
// Tests — périmètres de la carte (retour de test du 06/10, S5R-10)
//
// Bug : plusieurs quartiers cochés, un seul dessiné. Le vrai <GeoJSON>
// de react-leaflet ne relit `data` qu'à sa création ; on le remplace
// ici par un faux qui fait EXACTEMENT pareil (useState(data) : figé au
// premier rendu), pour vérifier que la carte le recrée bien quand le
// contenu change.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  // ResizeWatcher (S5R-11 v2) : une « carte » minimale
  useMap: () => ({ invalidateSize: () => {}, getContainer: () => document.createElement('div') }),
  GeoJSON: ({ data }) => {
    const [frozen] = useState(data); // comme react-leaflet : lu une seule fois
    return <div data-testid="perimeter">{frozen.features?.length ?? 1}</div>;
  },
}));
vi.mock('leaflet', () => ({ default: { divIcon: () => ({}), icon: () => ({}) } }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const { default: MapView, contentKey } = await import('./MapView.jsx');

const zone = (n) => ({ type: 'FeatureCollection', features: Array.from({ length: n }, (_, i) => ({ type: 'Feature', properties: { i }, geometry: null })) });

describe('MapView — périmètres', () => {
  it('redessine la zone quand on coche un quartier de plus', () => {
    const { rerender } = render(<MemoryRouter><MapView perimeters={[zone(1)]} /></MemoryRouter>);
    expect(screen.getByTestId('perimeter')).toHaveTextContent('1');

    rerender(<MemoryRouter><MapView perimeters={[zone(3)]} /></MemoryRouter>);
    expect(screen.getByTestId('perimeter')).toHaveTextContent('3');
  });

  it('contentKey : même contenu → même clé ; contenu différent → clé différente', () => {
    expect(contentKey(zone(2))).toBe(contentKey(zone(2)));
    expect(contentKey(zone(2))).not.toBe(contentKey(zone(3)));
  });
});
