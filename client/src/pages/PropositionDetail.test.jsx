// ══════════════════════════════════════════════════════════
// Tests — page d'une proposition (S5R2-08 : chargement commun, vote)
//
// Page sans tests jusqu'ici. On vérifie le chargement (useApiQuery),
// le vote, et le défaut trouvé pendant l'audit : une erreur de vote
// n'était jamais affichée.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../services/api.js', () => ({ api: apiMock, assetUrl: (p) => p }));
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isStaff: false, user: { id: 'u1', emailVerified: true } }),
}));
vi.mock('../contexts/ToastContext.jsx', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../utils/irisData.js', () => ({ loadIris: () => Promise.resolve(null) }));
vi.mock('../components/MapView/LazyMapView.jsx', () => ({ default: () => null }));
const { default: PropositionDetail } = await import('./PropositionDetail.jsx');

const PROPOSAL = {
  id: 'p1', slug: 'pietonnisation', title: 'Piétonniser la rue de la République', summary: 'Résumé',
  content: 'Texte', status: 'PUBLISHED', zoneWholeCity: false, zoneQuartiers: [],
};
const VOTES = { POUR: 3, CONTRE: 1, NEUTRE: 0, total: 4 };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/propositions/pietonnisation']}>
      <Routes><Route path="/propositions/:slug" element={<PropositionDetail />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // jsdom ne connaît ni matchMedia ni IntersectionObserver (apparition au défilement)
  window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  window.IntersectionObserver = vi.fn(function IO() { this.observe = vi.fn(); this.disconnect = vi.fn(); this.unobserve = vi.fn(); });
  apiMock.get = vi.fn(async () => ({ proposal: PROPOSAL, votes: VOTES, myVote: null }));
  apiMock.put = vi.fn();
  apiMock.delete = vi.fn();
  sessionStorage.clear();
});

describe('PropositionDetail', () => {
  it('charge la proposition (chargement, puis titre)', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: PROPOSAL.title })).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith('/proposals/pietonnisation');
  });

  it('proposition introuvable : message clair', async () => {
    apiMock.get = vi.fn(() => Promise.reject({ status: 404, message: 'Not found' }));
    renderPage();
    expect(await screen.findByText("Cette proposition n'existe pas ou plus.")).toBeInTheDocument();
  });

  it('voter met à jour le bouton actif, sans recharger la page', async () => {
    apiMock.put = vi.fn(async () => ({ votes: { ...VOTES, POUR: 4, total: 5 } }));
    renderPage();
    const pour = await screen.findByRole('button', { name: /Pour/ });
    fireEvent.click(pour);
    await waitFor(() => expect(pour).toHaveAttribute('aria-pressed', 'true'));
    expect(apiMock.put).toHaveBeenCalledWith('/proposals/p1/vote', { value: 'POUR' });
    expect(apiMock.get).toHaveBeenCalledTimes(1);
  });

  it('S5R2-08 : une erreur de vote s\'affiche sous les boutons (elle était invisible)', async () => {
    apiMock.put = vi.fn(() => Promise.reject({ status: 409, message: 'Les votes sont clos.' }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Pour/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Les votes sont clos.');
  });

  it('un vote laissé en attente avant la connexion est rejoué au retour', async () => {
    sessionStorage.setItem('senlis:pendingVote', JSON.stringify({ proposalId: 'p1', value: 'CONTRE' }));
    apiMock.put = vi.fn(async () => ({ votes: VOTES }));
    renderPage();
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/proposals/p1/vote', { value: 'CONTRE' }));
    expect(sessionStorage.getItem('senlis:pendingVote')).toBeNull();
  });

  // ── Recette : changer un vote déjà enregistré demande confirmation ──
  describe('changer un vote déjà enregistré', () => {
    beforeEach(() => {
      // On revient sur une proposition où l'on a déjà voté « Pour »
      apiMock.get = vi.fn(async () => ({ proposal: PROPOSAL, votes: VOTES, myVote: 'POUR' }));
    });

    it('rappelle le vote déjà fait', async () => {
      renderPage();
      expect(await screen.findByText('Vous avez voté « Pour ».')).toBeInTheDocument();
    });

    it('« Non » : aucun appel à l\'API, le vote reste « Pour »', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Contre' }));

      // La question est posée, le focus est sur « Oui », les boutons de vote attendent
      expect(screen.getByText(/Voulez-vous changer votre vote pour « Contre »/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Oui, changer mon vote' })).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Contre' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Non, garder « Pour »' }));
      expect(screen.queryByText(/Voulez-vous changer votre vote/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Pour' })).toHaveAttribute('aria-pressed', 'true');
      expect(apiMock.put).not.toHaveBeenCalled();
    });

    it('« Oui » : le vote est remplacé (mise à jour, pas un 2e vote)', async () => {
      apiMock.put = vi.fn(async () => ({ votes: { ...VOTES, POUR: 2, CONTRE: 2 } }));
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Contre' }));
      fireEvent.click(screen.getByRole('button', { name: 'Oui, changer mon vote' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Contre' })).toHaveAttribute('aria-pressed', 'true'));
      expect(apiMock.put).toHaveBeenCalledWith('/proposals/p1/vote', { value: 'CONTRE' });
      expect(screen.queryByText(/Voulez-vous changer votre vote/)).toBeNull();
    });

    it('re-cliquer sur « Pour » retire le vote, sans question', async () => {
      apiMock.delete = vi.fn(async () => ({ votes: { ...VOTES, POUR: 2 } }));
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Pour' }));
      await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith('/proposals/p1/vote'));
      expect(screen.queryByText(/Voulez-vous changer votre vote/)).toBeNull();
    });

    it('un vote en attente (après connexion) différent du vote enregistré demande confirmation', async () => {
      sessionStorage.setItem('senlis:pendingVote', JSON.stringify({ proposalId: 'p1', value: 'NEUTRE' }));
      renderPage();
      expect(await screen.findByText(/Voulez-vous changer votre vote pour « Neutre »/)).toBeInTheDocument();
      expect(apiMock.put).not.toHaveBeenCalled();
    });
  });
});
