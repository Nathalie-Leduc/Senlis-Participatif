// ══════════════════════════════════════════════════════════
// Tests — questionnaire, moteur d'enquête v2 (S5R-05)
// Scénarios de la recette du 30/09 (enquête stationnement).
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';
import { numberRangeError, prefilledOptionFor } from './EnqueteRepondre.jsx';

vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
// Un MÊME objet user à chaque rendu, comme le vrai contexte : la page
// recharge l'enquête quand `user` change (useEffect [slug, user]) — un
// nouvel objet à chaque appel effacerait les réponses à chaque clic.
const mockUser = { emailVerified: true, travailleASenlis: null };
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const { default: EnqueteRepondre } = await import('./EnqueteRepondre.jsx');

// Q0 : combien de véhicules (« Aucun » termine) — Q1 : combien (≥ 1)
// Q2 : où sont-ils garés (≤ réponse à Q1) — Q3 : un commentaire
const survey = {
  id: 's1', slug: 'stationnement', title: 'Stationnement', status: 'OPEN',
  questions: [
    { id: 'q0', order: 0, label: 'Avez-vous un véhicule ?', type: 'CHOIX_UNIQUE', required: true, conditionOptionIds: [],
      options: [{ id: 'aucun', label: 'Aucun', endsSurvey: true }, { id: 'oui', label: 'Oui', endsSurvey: false }] },
    { id: 'q1', order: 1, label: 'Combien ?', type: 'NOMBRE', required: true, conditionOptionIds: ['oui'], minValue: 1, maxValue: 10, options: [] },
    { id: 'q2', order: 2, label: 'Où sont-ils garés ?', type: 'CHOIX_MULTIPLE', required: true, conditionOptionIds: ['oui'], maxChoicesFromId: 'q1',
      options: [{ id: 'garage', label: 'Garage' }, { id: 'rue', label: 'Rue' }, { id: 'parking', label: 'Parking' }] },
    { id: 'q3', order: 3, label: 'Un commentaire ?', type: 'TEXTE_LIBRE', required: false, conditionOptionIds: [], options: [] },
  ],
};

async function renderSurvey() {
  api.get.mockResolvedValue({ survey, hasResponded: false });
  render(
    <MemoryRouter initialEntries={['/enquetes/stationnement/repondre']}>
      <Routes><Route path="/enquetes/:slug/repondre" element={<EnqueteRepondre />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByText('Avez-vous un véhicule ?', { selector: 'h2 *, h2' });
}

describe('Questionnaire v2', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); });

  it("« Aucun » termine l'enquête : le total tombe à 1 et le bouton devient « Terminer »", async () => {
    await renderSurvey();
    expect(screen.getByText('Question 1 sur 2')).toBeInTheDocument(); // q0 et q3 ; q1/q2 cachées tant que « Oui » n'est pas choisi
    fireEvent.click(screen.getByRole('radio', { name: 'Aucun' }));
    expect(screen.getByText('Question 1 sur 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeInTheDocument();
  });

  it('les bornes du nombre bloquent « Suivant » avec un message sous le champ', async () => {
    await renderSurvey();
    fireEvent.click(screen.getByRole('radio', { name: 'Oui' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByText('La valeur doit être au moins 1.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });

  it('pas plus de cases cochées que de véhicules : les autres cases se désactivent', async () => {
    await renderSurvey();
    fireEvent.click(screen.getByRole('radio', { name: 'Oui' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));

    fireEvent.click(screen.getByRole('button', { name: /Garage/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rue/ }));
    expect(screen.getByText(/2 sur 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parking/ })).toBeDisabled();
    // on peut toujours décocher
    expect(screen.getByRole('button', { name: /Garage/ })).not.toBeDisabled();
  });
});

describe('Fonctions utilitaires', () => {
  it('numberRangeError', () => {
    const q = { type: 'NOMBRE', minValue: 1, maxValue: 5 };
    expect(numberRangeError(q, { valueNumber: 0 })).toMatch(/au moins 1/);
    expect(numberRangeError(q, { valueNumber: 6 })).toMatch(/au plus 5/);
    expect(numberRangeError(q, { valueNumber: 3 })).toBeNull();
    expect(numberRangeError(q, undefined)).toBeNull();
  });

  it('prefilledOptionFor : « travaille à Senlis » préremplit Oui, Non, ou rien si inconnu', () => {
    const q = { syncsToProfile: 'travailleASenlis', type: 'OUI_NON',
      options: [{ id: 'oui', syncValue: 'true' }, { id: 'non', syncValue: 'false' }] };
    expect(prefilledOptionFor(q, { travailleASenlis: true }).id).toBe('oui');
    expect(prefilledOptionFor(q, { travailleASenlis: false }).id).toBe('non');
    expect(prefilledOptionFor(q, { travailleASenlis: null })).toBeNull();
  });
});
