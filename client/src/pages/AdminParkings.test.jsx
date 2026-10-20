// ══════════════════════════════════════════════════════════
// Tests — écran d'administration « Parkings » (S5R2-05)
// La carte (Leaflet) est remplacée par un faux qui garde ses props :
// on peut « cliquer sur la carte » pour placer un parking.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

const ITEMS = [
  { id: 'k1', name: 'Parking Saint-Rieul', places: 98, regime: 'GRATUIT', charging: 'AUCUNE', chargingPoints: null, pmrPlaces: null, note: null, lat: 49.208, lng: 2.588 },
  { id: 'k2', name: 'Parking de la Poste', places: 17, regime: 'ZONE_VERTE', charging: 'AUCUNE', chargingPoints: null, pmrPlaces: null, note: null, lat: null, lng: null },
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

  it('placer un parking : « Placer », clic sur la carte, Enregistrer → PATCH avec les coordonnées', async () => {
    api.patch.mockResolvedValue({ parking: { ...ITEMS[1], lat: 49.2051, lng: 2.5872 } });
    renderPage();
    fireEvent.click((await rowOf('Parking de la Poste')).getByRole('button', { name: /Modifier ou placer/ }));

    // Le clic sur la carte remplit la position (sans l'enregistrer encore)
    mapProps.onPlace({ lat: 49.2051, lng: 2.5872 });
    expect(await screen.findByLabelText('Latitude')).toHaveValue('49.2051');
    expect(screen.getByText(/Placé — cliquez ailleurs/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/parkings/k2', expect.objectContaining({
      name: 'Parking de la Poste', places: 17, regime: 'ZONE_VERTE', lat: 49.2051, lng: 2.5872,
    })));
    expect(await (await rowOf('Parking de la Poste')).findByText('📍 placé')).toBeInTheDocument();
  });

  it('ajouter un parking avec son seul nom (POST, régime « à préciser »)', async () => {
    api.post.mockResolvedValue({ parking: { id: 'k3', name: 'Parking Thomas Couture', places: null, regime: null, charging: 'AUCUNE', lat: null, lng: null } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '+ Ajouter un parking' }));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { name: 'name', value: 'Parking Thomas Couture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/parkings', expect.objectContaining({ name: 'Parking Thomas Couture', regime: null, lat: null })));
    expect(await screen.findByText('Parking Thomas Couture')).toBeInTheDocument();
  });

  it('coordonnées illisibles : rien n’est envoyé, l’erreur s’affiche à côté du bouton', async () => {
    renderPage();
    fireEvent.click((await rowOf('Parking de la Poste')).getByRole('button', { name: /Modifier ou placer/ }));
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { name: 'lat', value: '49,2a' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { name: 'lng', value: '2.58' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Coordonnées illisibles');
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('une erreur de l’API (détail par champ) s’affiche à côté du bouton', async () => {
    api.patch.mockRejectedValue({ status: 400, message: 'Données invalides', details: { lat: 'Latitude et longitude vont ensemble' } });
    renderPage();
    fireEvent.click((await rowOf('Parking Saint-Rieul')).getByRole('button', { name: /Modifier ou placer/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('vont ensemble');
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
    expect(mapProps.onPlace).toBeUndefined();
  });
});
