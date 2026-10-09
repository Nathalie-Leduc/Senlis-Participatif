// ══════════════════════════════════════════════════════════
// Tests — bouton « Voir » des listes admin (S5R-12)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Connecté·e en administratrice (S5R2-11 : les pages de gestion lisent le rôle)
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isAdmin: true, isEditor: false, isStaff: true, user: { role: 'ADMIN' } }),
}));
vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn((url) => Promise.resolve({
      items: url.startsWith('/proposals')
        ? [{ id: 'p1', slug: 'pieton', title: 'Piétonnisation', status: 'DRAFT' }]
        : [{ id: 's1', slug: 'stationnement', title: 'Stationnement', status: 'OPEN', resultsPublished: false }],
      pagination: { page: 1, totalPages: 1, total: 1 },
    })),
    patch: vi.fn(), delete: vi.fn(),
  },
}));
vi.mock('../contexts/ToastContext.jsx', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const { default: AdminPropositions } = await import('./AdminPropositions.jsx');
const { default: AdminSurveys } = await import('./AdminSurveys.jsx');

describe('Listes admin — bouton « Voir »', () => {
  it('chaque proposition (même en brouillon) mène à sa page publique', async () => {
    render(<MemoryRouter><AdminPropositions /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'Voir « Piétonnisation » comme les citoyens' });
    expect(link).toHaveAttribute('href', '/propositions/pieton');
  });

  it('chaque enquête mène à sa page publique', async () => {
    render(<MemoryRouter><AdminSurveys /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'Voir « Stationnement » comme les citoyens' });
    expect(link).toHaveAttribute('href', '/enquetes/stationnement');
  });
});
