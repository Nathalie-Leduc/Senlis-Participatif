// ══════════════════════════════════════════════════════════
// Tests — formulaire de proposition : zone et réglages avancés (S5R-10)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';

// Connecté·e en administratrice (S5R2-11 : les pages de gestion lisent le rôle)
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isAdmin: true, isEditor: false, isStaff: true, user: { role: 'ADMIN' } }),
}));
vi.mock('../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn().mockResolvedValue({ proposal: { id: 'p1' } }), patch: vi.fn().mockResolvedValue({ proposal: { id: 'p1' } }) },
  assetUrl: (p) => p,
}));
// Pas de vraie carte (Leaflet) ni de fichier IRIS dans les tests
vi.mock('../components/MapView/LazyMapView.jsx', () => ({ default: () => <div data-testid="map" /> }));
vi.mock('../utils/irisData.js', () => ({ loadIris: () => Promise.resolve(null) }));

const { default: AdminPropositionForm } = await import('./AdminPropositionForm.jsx');

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/propositions/nouvelle" element={<AdminPropositionForm />} />
        <Route path="/admin/propositions/:slug/modifier" element={<AdminPropositionForm />} />
        <Route path="/admin/propositions" element={<p>liste</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const fill = () => {
  fireEvent.change(screen.getByLabelText(/^Titre/), { target: { name: 'title', value: 'Piétonniser la rue de Paris' } });
  fireEvent.change(screen.getByLabelText(/^Accroche/), { target: { name: 'summary', value: 'Un résumé suffisamment long' } });
  fireEvent.change(screen.getByLabelText(/^Argumentaire/), { target: { name: 'content', value: 'Un argumentaire suffisamment long pour Zod.' } });
};

describe('Formulaire de proposition — zone', () => {
  beforeEach(() => { api.post.mockClear(); api.patch.mockClear(); });

  it('les champs principaux ont une aide reliée', () => {
    renderAt('/admin/propositions/nouvelle');
    expect(screen.getByLabelText(/^Titre/)).toHaveAccessibleDescription(/Une action concrète/);
  });

  it('envoie les quartiers choisis ; coordonnées et GeoJSON sont rangés sous « Avancé »', async () => {
    renderAt('/admin/propositions/nouvelle');
    expect(screen.getByText(/Avancé : un point précis/).closest('details')).not.toHaveAttribute('open');

    fill();
    fireEvent.click(screen.getByRole('radio', { name: 'Un ou plusieurs quartiers' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Brichebay' }));
    fireEvent.submit(screen.getByLabelText(/^Titre/).closest('form'));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1]).toMatchObject({ zoneWholeCity: false, zoneQuartiers: ['BRICHEBAY'], lat: undefined });
  });

  it('« quartiers » sans quartier coché : message, rien n’est envoyé', () => {
    renderAt('/admin/propositions/nouvelle');
    fill();
    fireEvent.click(screen.getByRole('radio', { name: 'Un ou plusieurs quartiers' }));
    fireEvent.submit(screen.getByLabelText(/^Titre/).closest('form'));
    expect(screen.getByText(/Cochez au moins un quartier/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('en modification, vider le point précis envoie null (effacement)', async () => {
    api.get.mockResolvedValueOnce({ proposal: {
      id: 'p1', title: 'Piétonniser la rue de Paris', summary: 'Un résumé suffisamment long', content: 'Un argumentaire suffisamment long pour Zod.',
      status: 'DRAFT', lat: 49.2, lng: 2.58, geoJson: null, closesAt: null, zoneWholeCity: true, zoneQuartiers: [],
    } });
    renderAt('/admin/propositions/pieton/modifier');

    const lat = await screen.findByLabelText(/^Latitude/);
    expect(screen.getByRole('radio', { name: 'Toute la ville' })).toBeChecked();
    expect(lat.closest('details')).toHaveAttribute('open'); // ouvert : il contient un point

    fireEvent.change(lat, { target: { name: 'lat', value: '' } });
    fireEvent.change(screen.getByLabelText(/^Longitude/), { target: { name: 'lng', value: '' } });
    fireEvent.submit(lat.closest('form'));

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][1]).toMatchObject({ lat: null, lng: null, geoJson: null, zoneWholeCity: true });
  });
});
