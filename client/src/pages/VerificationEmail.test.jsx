// ══════════════════════════════════════════════════════════
// Tests — page de vérification d'email (S5R-01)
//
// On rejoue le bug de recette : la page rendue en StrictMode
// (comme en développement) envoyait le jeton deux fois et finissait
// sur « Oups » alors que l'adresse était vérifiée.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerificationEmail from './VerificationEmail.jsx';
import { api } from '../services/api.js';
import { resetVerifyEmailOnce } from '../utils/verifyEmailOnce.js';

vi.mock('../services/api.js', () => ({ api: { post: vi.fn() } }));

function renderWithToken(token = 'abc123') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/verification-email?token=${token}`]}>
        <VerificationEmail />
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('VerificationEmail', () => {
  beforeEach(() => {
    api.post.mockReset();
    resetVerifyEmailOnce();
  });

  it("en StrictMode, n'envoie le jeton qu'UNE fois et affiche le succès", async () => {
    // Comportement de l'ANCIENNE API : 1er appel OK, 2e appel en erreur.
    // Si la page appelait deux fois, l'erreur écraserait le succès.
    api.post
      .mockResolvedValueOnce({ message: 'Email vérifié avec succès !' })
      .mockRejectedValueOnce({ code: 'INVALID_TOKEN', message: 'Jeton invalide ou déjà utilisé' });

    renderWithToken();

    expect(await screen.findByRole('heading', { name: /Email vérifié/ })).toBeInTheDocument();
    const verifyCalls = api.post.mock.calls.filter(([path]) => path === '/auth/verify-email');
    expect(verifyCalls).toHaveLength(1);
  });

  it('un lien expiré propose de recevoir un nouveau lien (et plus « Réessayer l’inscription »)', async () => {
    api.post.mockRejectedValueOnce({ code: 'TOKEN_EXPIRED', message: 'Ce jeton a expiré' });
    renderWithToken('expire');

    expect(await screen.findByRole('heading', { name: /ne fonctionne plus/ })).toBeInTheDocument();
    expect(screen.queryByText(/Réessayer l'inscription/)).toBeNull();

    api.post.mockResolvedValueOnce({ message: 'Si un compte en attente…, un nouveau lien vient de lui être envoyé.' });
    fireEvent.change(screen.getByLabelText('Votre adresse email'), { target: { value: 'nath@exemple.fr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer le lien' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/nouveau lien/);
    expect(api.post).toHaveBeenLastCalledWith('/auth/resend-verification', { email: 'nath@exemple.fr' });
  });
});
