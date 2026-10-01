// ══════════════════════════════════════════════════════════
// Tests — erreurs SOUS chaque champ (S5R-02, recette du 30/09)
//
// « Signaler tard, récompenser tôt » : l'erreur apparaît en QUITTANT
// le champ, et disparaît dès que la saisie est corrigée.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const login = vi.fn();
const register = vi.fn();
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ login, register, verifyTwoFactor: vi.fn(), isLogged: false, isAdmin: false }),
}));

const { default: Inscription } = await import('./Inscription.jsx');
const { default: Connexion } = await import('./Connexion.jsx');

const renderPage = (Page) => render(<MemoryRouter><Page /></MemoryRouter>);
const type = (label, value) => {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { name: field.name, value } });
  return field;
};

describe('Inscription — validation champ par champ', () => {
  beforeEach(() => {
    sessionStorage.clear();
    register.mockReset();
  });

  it("n'affiche rien pendant la frappe, l'erreur en quittant le champ, et l'efface dès la correction", () => {
    renderPage(Inscription);
    const email = type('Email', 'nath');
    expect(email).not.toHaveAttribute('aria-invalid');      // pas pendant la frappe

    fireEvent.blur(email);
    expect(email).toHaveAttribute('aria-invalid', 'true');   // en quittant le champ
    expect(email).toHaveAccessibleDescription(/Adresse email invalide/);

    type('Email', 'nath@exemple.fr');                        // corrigé
    expect(email).not.toHaveAttribute('aria-invalid');
  });

  it("propose « Vouliez-vous dire … ? » et corrige l'adresse d'un clic", () => {
    renderPage(Inscription);
    type('Email', 'nath@gmial.com');
    fireEvent.click(screen.getByRole('button', { name: 'nath@gmail.com' }));
    expect(screen.getByLabelText('Email')).toHaveValue('nath@gmail.com');
  });

  it('« je travaille à Senlis » coché : quartier ET rôle deviennent obligatoires, avec message', async () => {
    renderPage(Inscription);
    fireEvent.click(screen.getByRole('checkbox', { name: /Je travaille/ }));
    fireEvent.submit(screen.getByLabelText('Pseudo').closest('form'));

    expect(await screen.findByText('Choisissez le quartier où vous travaillez')).toBeInTheDocument();
    expect(screen.getByText(/Précisez si vous dirigez cette activité/)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("à l'envoi : TOUTES les erreurs d'un coup, un résumé, et le focus sur la première", async () => {
    renderPage(Inscription);
    fireEvent.submit(screen.getByLabelText('Pseudo').closest('form'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/champs sont à corriger/);
    expect(screen.getByLabelText('Pseudo')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Pseudo')));
  });
});

describe('Connexion', () => {
  it("propose l'œil pour afficher le mot de passe", () => {
    renderPage(Connexion);
    const toggle = screen.getByRole('button', { name: 'Afficher le mot de passe' });
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'text');
  });

  it("n'appelle pas l'API avec un email mal formé ; l'erreur est sous le champ", async () => {
    renderPage(Connexion);
    type('Email', 'pas-un-email');
    type('Mot de passe', 'x');
    fireEvent.submit(screen.getByLabelText('Email').closest('form'));

    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/invalide/);
    expect(login).not.toHaveBeenCalled();
  });
});
