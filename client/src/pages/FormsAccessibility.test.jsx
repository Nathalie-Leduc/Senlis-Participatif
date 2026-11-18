// ══════════════════════════════════════════════════════════
// Tests — formulaires publics accessibles (S5A-07, RGAA 11.10)
//
// On vérifie ce que vit une personne au lecteur d'écran : après une
// erreur, le message est une alerte, et le champ concerné est marqué
// invalide ET décrit par ce message.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Faux contexte d'authentification : on contrôle ce que renvoie l'API
const login = vi.fn();
const register = vi.fn();
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ login, register, verifyTwoFactor: vi.fn(), isLogged: false, isAdmin: false }),
}));

const { default: Connexion } = await import('./Connexion.jsx');
const { default: Inscription } = await import('./Inscription.jsx');

function renderPage(Page) {
  return render(<MemoryRouter><Page /></MemoryRouter>);
}

describe('Connexion', () => {
  it('Entrée soumet le formulaire ; une erreur est annoncée et reliée aux deux champs', async () => {
    login.mockRejectedValueOnce({ status: 401, message: 'Email ou mot de passe incorrect' });
    renderPage(Connexion);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.fr' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'x' } });
    // submit du <form> = ce que fait la touche Entrée
    fireEvent.submit(screen.getByLabelText('Email').closest('form'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email ou mot de passe incorrect');
    for (const label of ['Email', 'Mot de passe']) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription('Email ou mot de passe incorrect');
    }
  });
});

describe('Inscription', () => {
  function fill(labels) {
    for (const [label, value] of Object.entries(labels)) {
      fireEvent.change(screen.getByLabelText(label), { target: { name: screen.getByLabelText(label).name, value } });
    }
  }

  it('mots de passe différents : erreur reliée au SEUL champ de confirmation', async () => {
    renderPage(Inscription);
    fill({ 'Mot de passe': 'lanterne remparts tilleul', 'Confirmer le mot de passe': 'Autre123456!' });
    fireEvent.submit(screen.getByLabelText('Pseudo').closest('form'));

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Confirmer le mot de passe')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Mot de passe')).not.toHaveAttribute('aria-invalid');
    expect(register).not.toHaveBeenCalled();
  });

  it("pseudo déjà pris (409 de l'API) : erreur reliée au champ Pseudo, qui reçoit le focus", async () => {
    register.mockRejectedValueOnce({ status: 409, code: 'PSEUDO_TAKEN', message: 'Ce pseudo est déjà pris' });
    renderPage(Inscription);
    fill({
      Pseudo: 'nath', Email: 'a@b.fr',
      'Mot de passe': 'lanterne remparts tilleul', 'Confirmer le mot de passe': 'lanterne remparts tilleul',
    });
    fireEvent.change(screen.getByLabelText(/Votre situation/), { target: { name: 'situation', value: 'CENTRE_RESIDENT' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /pris connaissance/ }));
    fireEvent.submit(screen.getByLabelText('Pseudo').closest('form'));

    // S5R-02 : l'erreur s'affiche désormais SOUS le champ (zone
    // aria-live), plus en alerte en haut du formulaire
    const pseudo = screen.getByLabelText('Pseudo');
    await waitFor(() => expect(pseudo).toHaveAttribute('aria-invalid', 'true'));
    expect(pseudo).toHaveAccessibleDescription('Ce pseudo est déjà pris');
    await waitFor(() => expect(document.activeElement).toBe(pseudo));
  });

  it('S5R-13b : un mot de passe courant refusé par l’API s’affiche sous le champ Mot de passe', async () => {
    const message = 'Ce mot de passe fait partie des plus utilisés : choisissez-en un autre, par exemple quelques mots pris au hasard';
    register.mockRejectedValueOnce({ status: 400, code: 'VALIDATION_ERROR', details: { password: message } });
    renderPage(Inscription);
    fill({
      Pseudo: 'nath', Email: 'a@b.fr',
      'Mot de passe': 'iloveyouforever', 'Confirmer le mot de passe': 'iloveyouforever',
    });
    fireEvent.change(screen.getByLabelText(/Votre situation/), { target: { name: 'situation', value: 'CENTRE_RESIDENT' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /pris connaissance/ }));
    fireEvent.submit(screen.getByLabelText('Pseudo').closest('form'));

    const password = screen.getByLabelText('Mot de passe');
    await waitFor(() => expect(password).toHaveAttribute('aria-invalid', 'true'));
    expect(password).toHaveAccessibleDescription(message);
  });

  it('S5R-13b : 15 caractères en minuscules suffisent (plus de majuscule ni de chiffre exigés)', async () => {
    register.mockResolvedValueOnce({ message: 'Compte créé !' });
    renderPage(Inscription);
    fill({
      Pseudo: 'nath', Email: 'a@b.fr',
      'Mot de passe': 'lanterne remparts tilleul', 'Confirmer le mot de passe': 'lanterne remparts tilleul',
    });
    fireEvent.change(screen.getByLabelText(/Votre situation/), { target: { name: 'situation', value: 'CENTRE_RESIDENT' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /pris connaissance/ }));
    fireEvent.submit(screen.getByLabelText('Pseudo').closest('form'));

    await waitFor(() => expect(register).toHaveBeenCalledWith(expect.objectContaining({ password: 'lanterne remparts tilleul' })));
  });
});
