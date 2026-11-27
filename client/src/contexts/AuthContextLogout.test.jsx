// ══════════════════════════════════════════════════════════
// Tests — la déconnexion ne laisse aucune saisie derrière elle (S5R2-13)
// Ordinateur partagé (médiathèque, mairie) : la personne suivante ne
// doit retrouver ni les réponses ni les brouillons de la précédente.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { saveDraft, loadDraft } from '../utils/draftStorage.js';

vi.mock('../services/api.js', () => ({
  api: { get: vi.fn().mockResolvedValue({ user: { id: 'u1', role: 'CITIZEN' } }), post: vi.fn() },
}));
const { AuthProvider, useAuth } = await import('./AuthContext.jsx');

function LogoutButton() {
  const { user, logout } = useAuth();
  return <button type="button" onClick={logout}>{user ? 'Se déconnecter' : 'Déconnecté'}</button>;
}

describe('Déconnexion', () => {
  it('efface les brouillons et les réponses en cours, garde les réglages d’accessibilité', async () => {
    localStorage.setItem('token', 'jeton');
    localStorage.setItem('senlis-a11y-settings', '{}');
    saveDraft('u1', 'survey-answers:s1', { answers: {}, step: 2 });
    saveDraft('u1', 'survey-form:new', { form: {} });

    render(<AuthProvider><LogoutButton /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Déconnecté' })).toBeInTheDocument());
    expect(loadDraft('u1', 'survey-answers:s1')).toBeNull();
    expect(loadDraft('u1', 'survey-form:new')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('senlis-a11y-settings')).toBe('{}');
  });
});
