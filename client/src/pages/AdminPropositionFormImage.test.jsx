// ══════════════════════════════════════════════════════════
// Tests — formulaire de proposition : image refusée DÈS LE CHOIX
// (recette du 25/11 : un .docx renommé en .png n'était signalé qu'à
// l'enregistrement, quand le reste de la proposition était déjà gardé)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isAdmin: true, isEditor: false, isStaff: true, user: { role: 'ADMIN' } }),
}));
vi.mock('../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), uploadProposalImage: vi.fn() },
  assetUrl: (p) => p,
}));
vi.mock('../components/MapView/LazyMapView.jsx', () => ({ default: () => <div data-testid="map" /> }));
vi.mock('../utils/irisData.js', () => ({ loadIris: () => Promise.resolve(null) }));

const { default: AdminPropositionForm } = await import('./AdminPropositionForm.jsx');

// jsdom ne fabrique pas d'URL « blob: » : on la simule
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:apercu');
  URL.revokeObjectURL = vi.fn();
});

function renderForm() {
  render(
    <MemoryRouter initialEntries={['/admin/propositions/nouvelle']}>
      <Routes><Route path="/admin/propositions/nouvelle" element={<AdminPropositionForm />} /></Routes>
    </MemoryRouter>,
  );
  return document.querySelector('input[accept^="image"]');
}

describe('Formulaire de proposition — image', () => {
  it('un fichier illisible (aperçu impossible) est signalé et retiré du champ', () => {
    const input = renderForm();
    const faux = new File(['PK… un document Word'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [faux] } });

    // Le navigateur échoue à afficher l'aperçu → événement « error » de l'image
    fireEvent.error(screen.getByAltText('Aperçu'));

    expect(screen.getByRole('alert')).toHaveTextContent(/n'est pas une image lisible/);
    expect(screen.queryByAltText('Aperçu')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:apercu');
  });

  it('une image de plus de 5 Mo est refusée sans aperçu', () => {
    const input = renderForm();
    const lourde = new File(['x'], 'grande.jpg', { type: 'image/jpeg' });
    Object.defineProperty(lourde, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [lourde] } });

    expect(screen.getByRole('alert')).toHaveTextContent('Image trop lourde : 5 Mo au maximum.');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('une image lisible : aperçu affiché, aucun message', () => {
    const input = renderForm();
    fireEvent.change(input, { target: { files: [new File(['…'], 'vraie.png', { type: 'image/png' })] } });
    fireEvent.load(screen.getByAltText('Aperçu'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
