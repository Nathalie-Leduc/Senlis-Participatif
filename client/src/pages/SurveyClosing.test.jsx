// ══════════════════════════════════════════════════════════
// Tests — clôturer, rouvrir, supprimer une enquête ; liens retour
// (recette du 13/10)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';
import { endOfDayIso, startOfDayIso, toDateInput } from '../utils/surveyDates.js';
import BackLink from '../components/BackLink/BackLink.jsx';

const auth = vi.hoisted(() => ({ isStaff: true }));
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isAdmin: true, isEditor: false, isStaff: auth.isStaff, user: { id: 'u1', role: 'ADMIN' } }),
}));
vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('../contexts/ToastContext.jsx', () => ({ useToast: () => ({ showToast: toast }) }));

const { default: AdminSurveys } = await import('./AdminSurveys.jsx');

const DAY = 24 * 60 * 60 * 1000;
const open = { id: 's1', slug: 'enquete-ouverte', title: 'Ouverte', status: 'OPEN', resultsPublished: false, closesAt: null };
const closedLate = { id: 's2', slug: 'enquete-close', title: 'Close', status: 'CLOSED', resultsPublished: false, closesAt: new Date(Date.now() - DAY).toISOString() };

async function rowOf(slug) {
  return within((await screen.findByText(new RegExp(`/enquetes/${slug}`))).closest('.card-joyful'));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  auth.isStaff = true;
  api.get.mockResolvedValue({ items: [open, closedLate] });
});

describe('Dates d’enquête — jour choisi → heure locale', () => {
  it('la clôture tombe le soir du jour choisi, l’ouverture le matin', () => {
    const end = new Date(endOfDayIso('2026-10-31'));
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([31, 23, 59]);
    const start = new Date(startOfDayIso('2026-10-31'));
    expect([start.getDate(), start.getHours()]).toEqual([31, 0]);
    // aller-retour avec le champ <input type="date">
    expect(toDateInput(endOfDayIso('2026-10-31'))).toBe('2026-10-31');
    expect(toDateInput(null)).toBe('');
  });
});

describe('Clôturer… : maintenant ou à une date précise', () => {
  it('à une date précise : envoie closesAt (fin de journée), l’enquête reste ouverte', async () => {
    api.patch.mockImplementation((_, body) => Promise.resolve({ survey: { status: 'OPEN', closesAt: body.closesAt } }));
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    const row = await rowOf('enquete-ouverte');

    fireEvent.click(row.getByRole('button', { name: 'Clôturer…' }));
    fireEvent.click(row.getByLabelText(/À une date précise/));
    const confirm = row.getByRole('button', { name: 'Programmer la clôture' });
    expect(confirm).toBeDisabled(); // pas encore de date

    fireEvent.change(row.getByLabelText('Date de clôture'), { target: { value: '2026-12-31' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/surveys/s1', { closesAt: endOfDayIso('2026-12-31') }));
    expect(await row.findByText(/Clôture programmée le 31\/12\/2026/)).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Programmer la clôture' })).toBeNull(); // panneau refermé
  });

  it('« retirer la date » envoie closesAt: null', async () => {
    api.get.mockResolvedValue({ items: [{ ...open, closesAt: '2026-12-31T22:59:59.999Z' }] });
    api.patch.mockResolvedValue({ survey: { status: 'OPEN', closesAt: null } });
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    const row = await rowOf('enquete-ouverte');
    fireEvent.click(row.getByRole('button', { name: 'retirer la date' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/surveys/s1', { closesAt: null }));
    await waitFor(() => expect(row.queryByText(/Clôture programmée/)).toBeNull());
  });

  it('rouvrir une enquête dont la date est passée efface cette date', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.patch.mockResolvedValue({ survey: { status: 'OPEN', closesAt: null } });
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    const row = await rowOf('enquete-close');
    fireEvent.click(row.getByRole('button', { name: 'Rouvrir' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/surveys/s2', { status: 'OPEN', closesAt: null }));
  });
});

describe('Supprimer une enquête qui a des réponses', () => {
  const conflict = (canForce) => ({
    status: 409, code: 'SURVEY_HAS_RESPONSES', message: 'Impossible… clôturez-la plutôt que de la supprimer.',
    details: { responses: 3, canForce },
  });

  it('en développement : taper SUPPRIMER supprime avec les réponses', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('supprimer');
    api.delete.mockRejectedValueOnce(conflict(true)).mockResolvedValueOnce(null);
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    const row = await rowOf('enquete-ouverte');

    fireEvent.click(row.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(api.delete).toHaveBeenLastCalledWith('/surveys/s1?avecReponses=1'));
    expect(prompt.mock.calls[0][0]).toMatch(/3 réponse\(s\)/);
    await waitFor(() => expect(screen.queryByText(/\/enquetes\/enquete-ouverte/)).toBeNull());
  });

  it('un autre mot que SUPPRIMER : rien n’est supprimé', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'prompt').mockReturnValue('oui');
    api.delete.mockRejectedValueOnce(conflict(true));
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    fireEvent.click((await rowOf('enquete-ouverte')).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/il fallait taper SUPPRIMER/);
    expect(api.delete).toHaveBeenCalledTimes(1);
  });

  it('en production (canForce faux) : pas de proposition, le message de l’API s’affiche', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const prompt = vi.spyOn(window, 'prompt');
    api.delete.mockRejectedValueOnce(conflict(false));
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    fireEvent.click((await rowOf('enquete-ouverte')).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/clôturez-la/);
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe('Lien « ← Retour » des fiches', () => {
  const lists = {
    publicList: { to: '/enquetes', label: 'Toutes les enquêtes' },
    staffList: { to: '/admin/enquetes', label: 'Administration — Enquêtes' },
  };
  const renderAt = (entry) => render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/enquetes/:slug" element={<BackLink {...lists} />} /></Routes>
    </MemoryRouter>,
  );

  it('revient à la page d’où l’on vient quand elle l’a indiqué', () => {
    renderAt({ pathname: '/enquetes/x', state: { from: '/carte', fromLabel: 'La carte' } });
    expect(screen.getByRole('link', { name: '← La carte' })).toHaveAttribute('href', '/carte');
  });

  it('sinon : l’équipe revient à l’administration…', () => {
    renderAt('/enquetes/x');
    expect(screen.getByRole('link', { name: /Administration — Enquêtes/ })).toHaveAttribute('href', '/admin/enquetes');
  });

  it('… et les citoyens à la liste publique', () => {
    auth.isStaff = false;
    renderAt('/enquetes/x');
    expect(screen.getByRole('link', { name: /Toutes les enquêtes/ })).toHaveAttribute('href', '/enquetes');
  });

  it('« Voir » dans la liste admin transmet l’adresse de retour', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/enquetes']}>
        <Routes>
          <Route path="/admin/enquetes" element={<AdminSurveys />} />
          <Route path="/enquetes/:slug" element={<BackLink {...lists} publicList={lists.publicList} staffList={{ to: '/autre', label: 'Autre' }} />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click((await rowOf('enquete-ouverte')).getByRole('link', { name: /Voir « Ouverte »/ }));
    expect(await screen.findByRole('link', { name: '← Administration — Enquêtes' })).toHaveAttribute('href', '/admin/enquetes');
  });
});
