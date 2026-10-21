// ══════════════════════════════════════════════════════════
// Tests — écran d'administration « Parkings » (S5R2-05)
// La carte (Leaflet) est remplacée par un faux qui garde ses props :
// on peut « cliquer sur la carte » pour placer un parking.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../services/api.js';

const auth = vi.hoisted(() => ({ isAdmin: true }));
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isAdmin: auth.isAdmin, isEditor: !auth.isAdmin, isStaff: true, user: { id: 'u1' } }),
}));
vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../contexts/ToastContext.jsx', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
const mapProps = {};
vi.mock('../components/ParkingPlaceMap/ParkingPlaceMap.jsx', () => ({
  default: (props) => { Object.assign(mapProps, props); return <div data-testid="map" />; },
}));

const { default: AdminParkings } = await import('./AdminParkings.jsx');

const collection = (...geometries) => ({ type: 'GeometryCollection', geometries });
const ITEMS = [
  { id: 'k1', name: 'Parking Saint-Rieul', places: 98, regime: 'GRATUIT', charging: 'AUCUNE', chargingPoints: null, pmrPlaces: null, note: null, geometry: collection({ type: 'Point', coordinates: [2.588, 49.208] }) },
  { id: 'k2', name: 'Parking de la Poste', places: 17, regime: 'ZONE_VERTE', charging: 'AUCUNE', chargingPoints: null, pmrPlaces: null, note: null, geometry: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.isAdmin = true;
  for (const key of Object.keys(mapProps)) delete mapProps[key];
  api.get.mockResolvedValue({ items: ITEMS });
});

const renderPage = () => render(<MemoryRouter><AdminParkings /></MemoryRouter>);
const rowOf = async (name) => within((await screen.findByText(name)).closest('li'));

describe('Écran « Parkings »', () => {
  it('compte les parkings placés et à placer ; filtre « À placer »', async () => {
    renderPage();
    expect(await screen.findByText(/2 parkings/)).toHaveTextContent('1 placé sur la carte publique · 1 à placer');
    fireEvent.click(screen.getByRole('button', { name: 'À placer (1)' }));
    expect(screen.queryByText('Parking Saint-Rieul')).toBeNull();
    expect(screen.getByText('Parking de la Poste')).toBeInTheDocument();
  });

  it('placer un parking : « Placer », clic sur la carte, Enregistrer → PATCH avec la géométrie', async () => {
    api.patch.mockResolvedValue({ parking: { ...ITEMS[1], geometry: collection({ type: 'Point', coordinates: [2.5872, 49.2051] }) } });
    renderPage();
    fireEvent.click((await rowOf('Parking de la Poste')).getByRole('button', { name: /Modifier ou placer/ }));

    // Le clic sur la carte ajoute l'emplacement (sans l'enregistrer encore)
    act(() => mapProps.onMapClick({ lat: 49.2051, lng: 2.5872 }));
    expect(await screen.findByText(/Point — 49,2051, 2,5872/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/parkings/k2', expect.objectContaining({
      name: 'Parking de la Poste', places: 17, regime: 'ZONE_VERTE',
      geometry: collection({ type: 'Point', coordinates: [2.5872, 49.2051] }),
    })));
    expect(await (await rowOf('Parking de la Poste')).findByText('📍 1 point')).toBeInTheDocument();
  });

  it('plusieurs points ET un trait le long d’une rue (recette du 20/10)', async () => {
    api.patch.mockImplementation((_, body) => Promise.resolve({ parking: { ...ITEMS[0], geometry: body.geometry } }));
    renderPage();
    fireEvent.click((await rowOf('Parking Saint-Rieul')).getByRole('button', { name: /Modifier ou placer/ }));

    // Un 2e point (le 1er existait déjà)
    act(() => mapProps.onMapClick({ lat: 49.2090, lng: 2.5890 }));
    // Puis un trait de trois sommets
    fireEvent.click(screen.getByRole('button', { name: '〰️ Tracer un trait' }));
    act(() => mapProps.onMapClick({ lat: 49.2061, lng: 2.5862 }));
    expect(screen.getByRole('button', { name: 'Terminer le trait' })).toBeDisabled(); // un seul sommet
    act(() => mapProps.onMapClick({ lat: 49.2058, lng: 2.5871 }));
    act(() => mapProps.onMapClick({ lat: 49.2054, lng: 2.5880 }));
    expect(mapProps.editing.draft).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Terminer le trait' }));
    expect(screen.getByText(/Trait — 3 points/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const sent = api.patch.mock.calls[0][1].geometry.geometries;
    expect(sent.map((g) => g.type)).toEqual(['Point', 'Point', 'LineString']);
    expect(sent[2].coordinates).toEqual([[2.5862, 49.2061], [2.5871, 49.2058], [2.588, 49.2054]]);
    expect(await (await rowOf('Parking Saint-Rieul')).findByText('📍 2 points + 1 trait')).toBeInTheDocument();
  });

  it('un trait commencé mais pas terminé est enregistré avec le reste ; un trait d’un seul point bloque', async () => {
    api.patch.mockImplementation((_, body) => Promise.resolve({ parking: { ...ITEMS[1], geometry: body.geometry } }));
    renderPage();
    fireEvent.click((await rowOf('Parking de la Poste')).getByRole('button', { name: /Modifier ou placer/ }));
    fireEvent.click(screen.getByRole('button', { name: '〰️ Tracer un trait' }));
    act(() => mapProps.onMapClick({ lat: 49.2061, lng: 2.5862 }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('un point');
    expect(api.patch).not.toHaveBeenCalled();

    act(() => mapProps.onMapClick({ lat: 49.2058, lng: 2.5871 }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.patch.mock.calls[0][1].geometry.geometries[0].type).toBe('LineString'));
  });

  it('retirer un emplacement, puis tout retirer : geometry null', async () => {
    api.patch.mockResolvedValue({ parking: { ...ITEMS[0], geometry: null } });
    renderPage();
    fireEvent.click((await rowOf('Parking Saint-Rieul')).getByRole('button', { name: /Modifier ou placer/ }));
    fireEvent.click(screen.getByRole('button', { name: "Retirer l'emplacement 1" }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/parkings/k1', expect.objectContaining({ geometry: null })));
  });

  it('ajouter un parking avec son seul nom (POST, régime « à préciser »)', async () => {
    api.post.mockResolvedValue({ parking: { id: 'k3', name: 'Parking Thomas Couture', places: null, regime: null, charging: 'AUCUNE', geometry: null } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '+ Ajouter un parking' }));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { name: 'name', value: 'Parking Thomas Couture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/parkings', expect.objectContaining({ name: 'Parking Thomas Couture', regime: null, geometry: null })));
    expect(await screen.findByText('Parking Thomas Couture')).toBeInTheDocument();
  });

  it('coordonnées tapées au clavier : un point de plus ; illisibles, un message', async () => {
    renderPage();
    fireEvent.click((await rowOf('Parking de la Poste')).getByRole('button', { name: /Modifier ou placer/ }));
    fireEvent.click(screen.getByText('Saisir des coordonnées au clavier'));
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '49,2a' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '2.58' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter ce point' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Coordonnées illisibles');

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '49,2066' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter ce point' }));
    expect(screen.getByText(/Point — 49,2066, 2,58/)).toBeInTheDocument();
  });

  it('une erreur de l’API (détail par champ) s’affiche à côté du bouton', async () => {
    api.patch.mockRejectedValue({ status: 400, message: 'Données invalides', details: { 'geometry.geometries.0.coordinates.0': 'Un emplacement est hors de Senlis (latitude et longitude inversées ?)' } });
    renderPage();
    fireEvent.click((await rowOf('Parking Saint-Rieul')).getByRole('button', { name: /Modifier ou placer/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('inversées');
  });

  it('supprimer après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.delete.mockResolvedValue(null);
    renderPage();
    fireEvent.click((await rowOf('Parking Saint-Rieul')).getByRole('button', { name: /Supprimer/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/parkings/k1'));
    await waitFor(() => expect(screen.queryByText('Parking Saint-Rieul')).toBeNull());
  });

  it('Admin-test : consultation seule (ni ajout, ni modification, ni placement)', async () => {
    auth.isAdmin = false;
    renderPage();
    expect(await screen.findByText(/Consultation seule/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Ajouter un parking' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Modifier ou placer/ })).toBeNull();
    expect(mapProps.onMapClick).toBeUndefined();
  });
});
