// ══════════════════════════════════════════════════════════
// Tests — menu selon le rôle (S5R-12)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let auth;
vi.mock('../../contexts/AuthContext.jsx', () => ({ useAuth: () => auth }));
const { default: Header } = await import('./Header.jsx');

function renderHeader() {
  render(<MemoryRouter><Header /></MemoryRouter>);
  return within(screen.getByRole('navigation'));
}
const hrefs = (nav) => nav.getAllByRole('link').map((a) => a.getAttribute('href'));

describe('Menu principal', () => {
  it('visiteur : pages publiques, et la carte', () => {
    auth = { isLogged: false, isAdmin: false, user: null, logout: vi.fn() };
    const nav = renderHeader();
    expect(hrefs(nav)).toEqual(['/', '/propositions', '/enquetes', '/carte', '/connexion']);
  });

  it("admin : « Propositions » et « Enquêtes » mènent à la GESTION ; plus de doublons publics", () => {
    auth = { isLogged: true, isAdmin: true, user: { pseudo: 'Mairie' }, logout: vi.fn() };
    const nav = renderHeader();
    expect(nav.getByRole('link', { name: 'Propositions' })).toHaveAttribute('href', '/admin/propositions');
    expect(nav.getByRole('link', { name: 'Enquêtes' })).toHaveAttribute('href', '/admin/enquetes');
    expect(hrefs(nav)).not.toContain('/propositions');
    expect(hrefs(nav)).not.toContain('/enquetes');
    expect(hrefs(nav)).toEqual(expect.arrayContaining(['/admin/comptes', '/carte', '/mon-compte']));
    expect(nav.queryByText(/Admin propositions/)).toBeNull();
  });
});
