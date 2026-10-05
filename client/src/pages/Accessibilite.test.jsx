// Tests — déclaration d'accessibilité et plan du site (S5A-07)
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ACCESSIBILITY } from '../constants/legal.js';

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isLogged: true, isAdmin: false }),
}));

const { default: Accessibilite } = await import('./Accessibilite.jsx');
const { default: PlanDuSite } = await import('./PlanDuSite.jsx');

describe("Déclaration d'accessibilité", () => {
  it("affiche l'état de conformité, le contact et les voies de recours (modèle RGAA)", () => {
    const { container } = render(<MemoryRouter><Accessibilite /></MemoryRouter>);
    expect(container.textContent).toContain(ACCESSIBILITY.status);
    expect(container.textContent).toContain(ACCESSIBILITY.standard);
    expect(container.textContent).toMatch(/Défenseur des droits/);
    expect(container.textContent).not.toMatch(/\[[^\]]+\]/); // aucun placeholder
    expect(screen.getByRole('link', { name: /defenseurdesdroits/ })).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('Plan du site', () => {
  it("liste les pages publiques, « Mon compte » pour une personne connectée, mais pas l'administration", () => {
    render(<MemoryRouter><PlanDuSite /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Propositions et votes' })).toHaveAttribute('href', '/propositions');
    expect(screen.getByRole('link', { name: "Déclaration d'accessibilité" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mon compte' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Gérer les comptes/ })).toBeNull();
  });
});
