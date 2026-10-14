// ══════════════════════════════════════════════════════════
// Tests — enregistrer une enquête (recette du 13/10)
//  - le bouton d'enregistrement reste à portée (barre collée en bas) ;
//  - l'erreur s'affiche À CÔTÉ du bouton, pas en haut de la page ;
//  - « Clôturer » directement depuis la liste, en n'envoyant que le statut ;
//  - deux enquêtes au même titre se distinguent (adresse, date).
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isAdmin: true, isEditor: false, isStaff: true, user: { id: 'u1', role: 'ADMIN' } }),
}));
vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../contexts/ToastContext.jsx', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const { default: AdminSurveyForm } = await import('./AdminSurveyForm.jsx');
const { default: AdminSurveys } = await import('./AdminSurveys.jsx');

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('Formulaire d’enquête — barre d’enregistrement', () => {
  it('le bouton est dans la barre collée en bas, et l’erreur s’affiche à côté', async () => {
    api.post.mockRejectedValue(new Error('Trop de contenu envoyé en une seule fois'));
    render(
      <MemoryRouter initialEntries={['/admin/enquetes/nouvelle']}>
        <Routes><Route path="/admin/enquetes/nouvelle" element={<AdminSurveyForm />} /></Routes>
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: "Créer l'enquête" });
    const bar = button.closest('.form-save-bar');
    expect(bar).toHaveStyle({ position: 'sticky' });

    fireEvent.change(screen.getByLabelText('Titre'), { target: { name: 'title', value: 'Une enquête' } });
    fireEvent.submit(button.closest('form'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Trop de contenu');
    expect(bar).toContainElement(alert); // à côté du bouton, pas en haut
  });
});

describe('Liste des enquêtes — clôturer d’un clic', () => {
  const items = [
    { id: 's1', slug: 'stationnement-deplacements-centre-historique', title: 'Stationnement', status: 'OPEN', resultsPublished: false, createdAt: '2026-10-13T10:00:00Z' },
    { id: 's2', slug: 'stationnement-centre-historique', title: 'Stationnement', status: 'CLOSED', resultsPublished: false, createdAt: '2026-09-20T10:00:00Z' },
  ];

  it('deux enquêtes au même titre se distinguent par leur adresse et leur date', async () => {
    api.get.mockResolvedValue({ items });
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    expect(await screen.findByText(/\/enquetes\/stationnement-deplacements-centre-historique · créée le 13\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/\/enquetes\/stationnement-centre-historique · créée le 20\/09\/2026/)).toBeInTheDocument();
  });

  it('« Clôturer… » → « Maintenant » n’envoie que le statut (quelques octets)', async () => {
    api.get.mockResolvedValue({ items });
    api.patch.mockResolvedValue({ survey: { status: 'CLOSED' } });
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);

    const row = within((await screen.findByText(/stationnement-deplacements-centre-historique/)).closest('.card-joyful'));
    fireEvent.click(row.getByRole('button', { name: 'Clôturer…' }));
    fireEvent.click(row.getByRole('button', { name: 'Clôturer maintenant' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/surveys/s1', { status: 'CLOSED' }));
    expect(await row.findByRole('button', { name: 'Rouvrir' })).toBeInTheDocument();

    // L'ancienne, déjà close, se rouvre de la même façon
    const old = within(screen.getByText(/\/enquetes\/stationnement-centre-historique ·/).closest('.card-joyful'));
    expect(old.getByRole('button', { name: 'Rouvrir' })).toBeInTheDocument();
  });
});
