// ══════════════════════════════════════════════════════════
// Tests — modèles en tête du formulaire de proposition (S5R2-12)
// Analogie : choisir le patron avant de couper le tissu.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isAdmin: true, isEditor: false, isStaff: true, user: { role: 'ADMIN' } }),
}));
vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ proposal: { id: 'p1' } }),
    patch: vi.fn().mockResolvedValue({ proposal: { id: 'p1' } }),
  },
  assetUrl: (p) => p,
}));
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
const field = (label) => screen.getByLabelText(label);
const type = (label, name, value) => fireEvent.change(field(label), { target: { name, value } });

describe('Formulaire de proposition — modèles en premier', () => {
  beforeEach(() => {
    api.post.mockClear();
    vi.restoreAllMocks();
  });

  it('le choix du modèle est le premier bloc, avant le titre ; cinq choix', () => {
    renderAt('/admin/propositions/nouvelle');
    const heading = screen.getByRole('heading', { name: "Partir d'un modèle" });
    expect(heading.compareDocumentPosition(field(/^Titre/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const name of ['Page blanche', "Aménagement de l'espace public", 'Mobilité et stationnement', 'Végétalisation', 'Animation ou événement']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('un modèle préremplit titre, accroche et argumentaire en quatre rubriques, et se voit choisi', () => {
    renderAt('/admin/propositions/nouvelle');
    const greening = screen.getByRole('button', { name: /Végétalisation/ });
    fireEvent.click(greening);

    expect(greening).toHaveAttribute('aria-pressed', 'true');
    expect(field(/^Titre/)).toHaveValue('Végétaliser [lieu]');
    expect(field(/^Accroche/).value).toMatch(/^Planter/);
    const content = field(/^Argumentaire/).value;
    for (const section of ['Contexte', 'Ce qui changerait', 'Pour qui', 'Questions encore ouvertes']) {
      expect(content).toContain(`${section}\n`);
    }
    expect(screen.getByText(/Modèle « Végétalisation » appliqué/)).toBeInTheDocument();
  });

  it('changer de modèle sans avoir rien écrit : pas de confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderAt('/admin/propositions/nouvelle');
    fireEvent.click(screen.getByRole('button', { name: /Végétalisation/ }));
    fireEvent.click(screen.getByRole('button', { name: /Mobilité/ }));
    expect(confirm).not.toHaveBeenCalled();
    expect(field(/^Titre/).value).toMatch(/^Faciliter/);
  });

  it('un texte déjà saisi n’est remplacé qu’après confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/admin/propositions/nouvelle');
    type(/^Titre/, 'title', 'Mon propre titre');
    fireEvent.click(screen.getByRole('button', { name: /Végétalisation/ }));

    expect(confirm).toHaveBeenCalled();
    expect(field(/^Titre/)).toHaveValue('Mon propre titre'); // refusé : rien ne change
    expect(screen.getByRole('button', { name: /Végétalisation/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('enregistrer avec des [crochets] restants demande confirmation ; refuser n’envoie rien', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/admin/propositions/nouvelle');
    fireEvent.click(screen.getByRole('button', { name: /Animation/ }));
    fireEvent.submit(field(/^Titre/).closest('form'));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('crochets'));
    expect(api.post).not.toHaveBeenCalled();

    // Une fois complété, plus de question : la proposition part
    confirm.mockClear();
    type(/^Titre/, 'title', 'Organiser un marché de Noël place Henri IV');
    type(/^Accroche/, 'summary', 'Un marché de Noël le deuxième week-end de décembre.');
    type(/^Argumentaire/, 'content', 'Contexte\nIl n’existe pas de marché de Noël au centre.');
    fireEvent.submit(field(/^Titre/).closest('form'));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();
  });

  it('en modification, pas de modèles', async () => {
    api.get.mockResolvedValue({
      proposal: { id: 'p1', title: 'Titre existant', summary: 'Accroche existante', content: 'Argumentaire existant assez long', status: 'DRAFT' },
    });
    renderAt('/admin/propositions/titre-existant/modifier');
    await screen.findByDisplayValue('Titre existant');
    expect(screen.queryByRole('heading', { name: "Partir d'un modèle" })).toBeNull();
  });
});
