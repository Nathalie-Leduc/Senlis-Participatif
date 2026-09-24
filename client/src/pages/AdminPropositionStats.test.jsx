// ══════════════════════════════════════════════════════════
// Tests — AdminPropositionStats (S5-21)
//
// On ne teste PAS le masquage lui-même ici (c'est l'API qui le
// décide, testée dans api/tests/proposal-stats.test.js) : on vérifie
// que la page AFFICHE correctement ce que l'API lui envoie —
// chiffres pour un groupe visible, explication pour un groupe masqué,
// et appel de l'API avec le bon critère.
//
// services/api.js est remplacé par un faux (vi.mock) : aucun réseau.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminPropositionStats from './AdminPropositionStats.jsx';
import { api } from '../services/api.js';

vi.mock('../services/api.js', () => ({ api: { get: vi.fn() } }));

const BASE = {
  proposal: { id: 'p1', slug: 'pietonnisation', title: 'Piétonnisation', status: 'PUBLISHED' },
  votes: { POUR: 5, CONTRE: 2, NEUTRE: 0 },
  totalVotes: 7,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/propositions/p1/stats']}>
      <Routes>
        <Route path="/admin/propositions/:id/stats" element={<AdminPropositionStats />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminPropositionStats', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('affiche les totaux sans critère de segmentation', async () => {
    api.get.mockResolvedValue(BASE);
    renderPage();

    expect(await screen.findByText(/7 votes au total/)).toBeInTheDocument();
    expect(screen.getByText('5 — 71.4 %')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/proposals/p1/stats');
  });

  it('demande la segmentation choisie, affiche un groupe visible et explique un groupe masqué', async () => {
    api.get.mockResolvedValueOnce(BASE).mockResolvedValueOnce({
      ...BASE,
      segmentedBy: {
        dimension: 'situation',
        minGroupSize: 5,
        segments: [
          { value: 'CENTRE_RESIDENT', masked: false, totalVotes: 5, votes: { POUR: 5, CONTRE: 0, NEUTRE: 0 } },
          { value: 'HORS_SENLIS', masked: true, totalVotes: null, votes: null },
          { value: null, masked: false, totalVotes: 0, votes: { POUR: 0, CONTRE: 0, NEUTRE: 0 } },
        ],
      },
    });
    renderPage();
    await screen.findByText(/7 votes au total/);

    fireEvent.change(screen.getByLabelText(/Répartir les votes selon/), { target: { value: 'situation' } });

    expect(await screen.findByText('Résident du centre (5 votants)')).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith('/proposals/p1/stats?segmentBy=situation');

    // Groupe masqué : son nom, jamais de chiffre
    expect(screen.getByText('Hors Senlis')).toBeInTheDocument();
    expect(screen.getByText(/Moins de 5 votants — détail masqué/)).toBeInTheDocument();

    // Groupe vide, avec le libellé propre à l'axe
    expect(screen.getByText('Non renseignée (0 votant)')).toBeInTheDocument();
    expect(screen.getByText('Aucun votant dans ce groupe.')).toBeInTheDocument();
  });

  it("affiche l'erreur de l'API (ex. proposition introuvable)", async () => {
    api.get.mockRejectedValue({ status: 404, message: 'Proposition introuvable' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Proposition introuvable');
  });
});
