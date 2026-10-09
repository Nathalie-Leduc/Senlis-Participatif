// ══════════════════════════════════════════════════════════
// Tests — interface du rôle « Admin-test » (EDITOR, S5R2-11)
//
// Côté client, on vérifie surtout ce qu'on NE montre PAS : un bouton
// que l'API refuserait (403) n'a rien à faire à l'écran. Analogie :
// on ne donne pas à l'apprenti la sonnette « envoyer en salle ».
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';

// Rôle modifiable d'un test à l'autre (getter : lu à chaque appel de useAuth)
let role = 'EDITOR';
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({
    isLogged: true,
    isAdmin: role === 'ADMIN',
    isEditor: role === 'EDITOR',
    isStaff: role === 'ADMIN' || role === 'EDITOR',
    loading: false,
    user: { id: 'me', role, emailVerified: true },
  }),
}));
vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../contexts/ToastContext.jsx', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const { default: AdminSurveys } = await import('./AdminSurveys.jsx');
const { default: AdminPropositions } = await import('./AdminPropositions.jsx');
const { default: AdminSurveyForm } = await import('./AdminSurveyForm.jsx');
const { default: AdminUsers } = await import('./AdminUsers.jsx');
const { default: EnqueteDetail } = await import('./EnqueteDetail.jsx');
const { default: ProtectedRoute } = await import('../components/ProtectedRoute/ProtectedRoute.jsx');

/** La carte (ligne) d'une liste admin qui contient ce titre */
const rowOf = (title) => within(screen.getByText(title).closest('.card-joyful'));

beforeEach(() => {
  role = 'EDITOR';
  vi.clearAllMocks();
});

describe('Admin-test — listes de gestion', () => {
  it('enquêtes : actions sur les brouillons seulement, jamais les résultats', async () => {
    api.get.mockResolvedValue({
      items: [
        { id: 's1', slug: 'brouillon', title: 'Enquête brouillon', status: 'DRAFT', resultsPublished: false },
        { id: 's2', slug: 'ouverte', title: 'Enquête ouverte', status: 'OPEN', resultsPublished: false },
      ],
    });
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    await screen.findByText('Enquête brouillon');

    expect(screen.getByRole('note')).toHaveTextContent('Mode Admin-test');

    const draft = rowOf('Enquête brouillon');
    expect(draft.getByRole('link', { name: 'Modifier' })).toBeInTheDocument();
    expect(draft.getByRole('link', { name: /Tester/ })).toHaveAttribute('href', '/enquetes/brouillon/repondre');
    expect(draft.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();

    const open = rowOf('Enquête ouverte');
    expect(open.getByRole('link', { name: /Voir/ })).toBeInTheDocument();
    expect(open.queryByRole('link', { name: 'Modifier' })).toBeNull();
    expect(open.queryByRole('button', { name: 'Supprimer' })).toBeNull();

    expect(screen.queryByText('Résultats détaillés')).toBeNull();
    expect(screen.queryByText('Publier les résultats')).toBeNull();
  });

  it('propositions : pas de « Résultats », pas de modification d’une proposition publiée', async () => {
    api.get.mockResolvedValue({
      items: [{ id: 'p1', slug: 'publiee', title: 'Proposition publiée', status: 'PUBLISHED' }],
    });
    render(<MemoryRouter><AdminPropositions /></MemoryRouter>);
    await screen.findByText('Proposition publiée');
    const row = rowOf('Proposition publiée');
    expect(row.queryByText('Résultats')).toBeNull();
    expect(row.queryByRole('link', { name: 'Modifier' })).toBeNull();
  });

  it('un admin garde tous ses boutons (pas de bandeau)', async () => {
    role = 'ADMIN';
    api.get.mockResolvedValue({
      items: [{ id: 's2', slug: 'ouverte', title: 'Enquête ouverte', status: 'OPEN', resultsPublished: false }],
    });
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    await screen.findByText('Enquête ouverte');
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText('Résultats détaillés')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
  });
});

describe('Admin-test — formulaire d’enquête', () => {
  it('en création, pas de choix de statut : « Brouillon » est annoncé', () => {
    render(
      <MemoryRouter initialEntries={['/admin/enquetes/nouvelle']}>
        <Routes><Route path="/admin/enquetes/nouvelle" element={<AdminSurveyForm />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText('Statut')).toBeNull();
    expect(screen.getByText('Statut :').parentElement).toHaveTextContent('Brouillon');
  });

  it('une enquête ouverte n’est pas modifiable : explication au lieu du formulaire', async () => {
    api.get.mockResolvedValue({
      survey: { id: 's2', title: 'Enquête ouverte', description: 'Desc', status: 'OPEN', audience: {}, questions: [] },
    });
    render(
      <MemoryRouter initialEntries={['/admin/enquetes/ouverte/modifier']}>
        <Routes><Route path="/admin/enquetes/:slug/modifier" element={<AdminSurveyForm />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/n'est plus un brouillon/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Titre')).toBeNull();
  });
});

describe('Admin-test — page publique d’une enquête', () => {
  const survey = (status) => ({
    id: 's1', slug: 'x', title: 'Enquête', description: 'Desc', status, audience: null, questions: [],
  });

  it('brouillon : « Tester l’enquête » ; ouverte : ni tester ni répondre', async () => {
    api.get.mockResolvedValueOnce({ survey: survey('DRAFT'), hasResponded: false });
    const { unmount } = render(
      <MemoryRouter initialEntries={['/enquetes/x']}><Routes><Route path="/enquetes/:slug" element={<EnqueteDetail />} /></Routes></MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: /Tester l'enquête/ })).toBeInTheDocument();
    unmount();

    api.get.mockResolvedValueOnce({ survey: survey('OPEN'), hasResponded: false });
    render(
      <MemoryRouter initialEntries={['/enquetes/x']}><Routes><Route path="/enquetes/:slug" element={<EnqueteDetail />} /></Routes></MemoryRouter>,
    );
    await screen.findByText('Voir les résultats');
    expect(screen.queryByRole('button', { name: /Tester/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Répondre/ })).toBeNull();
  });
});

describe('Routes protégées', () => {
  function renderRoute(props) {
    render(
      <MemoryRouter initialEntries={['/admin/x']}>
        <Routes>
          <Route path="/admin/x" element={<ProtectedRoute {...props}><p>Page de gestion</p></ProtectedRoute>} />
          <Route path="/" element={<p>Accueil</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('staffOnly (gestion des brouillons) laisse entrer un Admin-test', () => {
    renderRoute({ staffOnly: true });
    expect(screen.getByText('Page de gestion')).toBeInTheDocument();
  });

  it('adminOnly (comptes, résultats détaillés) refuse un Admin-test', () => {
    renderRoute({ adminOnly: true });
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });

  it('staffOnly refuse un citoyen', () => {
    role = 'CITIZEN';
    renderRoute({ staffOnly: true });
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });
});

describe('Comptes — trois rôles', () => {
  it('l’admin passe un citoyen en Admin-test (après confirmation)', async () => {
    role = 'ADMIN';
    api.get.mockResolvedValue({ items: [{ id: 'u1', pseudo: 'mairie', email: 'mairie@senlis.fr', role: 'CITIZEN', emailVerified: true }] });
    api.patch.mockResolvedValue({ user: { id: 'u1', pseudo: 'mairie', email: 'mairie@senlis.fr', role: 'EDITOR', emailVerified: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MemoryRouter><AdminUsers /></MemoryRouter>);
    const select = await screen.findByLabelText('Rôle de mairie');
    expect(within(select).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Citoyen', 'Admin-test', 'Administrateur']);

    fireEvent.change(select, { target: { value: 'EDITOR' } });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('ne publie jamais'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/users/u1', { role: 'EDITOR' }));
    expect(await screen.findByLabelText('Rôle de mairie')).toHaveValue('EDITOR');
  });
});
