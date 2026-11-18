// Tests — rappel annuel de changer de mot de passe, équipe seulement (S5R-13b)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let currentUser = null;
vi.mock('../../contexts/AuthContext.jsx', () => ({ useAuth: () => ({ user: currentUser }) }));
const { default: PasswordRenewalBanner } = await import('./PasswordRenewalBanner.jsx');

const renderBanner = () => render(<MemoryRouter><PasswordRenewalBanner /></MemoryRouter>);

describe('PasswordRenewalBanner', () => {
  beforeEach(() => { currentUser = null; });

  it('rien quand le rappel n’est pas dû (ou personne de connecté)', () => {
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
    currentUser = { role: 'ADMIN', passwordRenewalDue: false };
    expect(renderBanner().container).toBeEmptyDOMElement();
  });

  it('quand l’API l’indique : un rappel, avec un lien vers le formulaire de Mon compte', () => {
    currentUser = { role: 'ADMIN', passwordRenewalDue: true };
    renderBanner();
    expect(screen.getByRole('note')).toHaveTextContent('Votre mot de passe a plus d\'un an');
    expect(screen.getByRole('link', { name: 'Changer mon mot de passe' })).toHaveAttribute('href', '/mon-compte#mot-de-passe');
  });
});
