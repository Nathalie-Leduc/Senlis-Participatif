// ══════════════════════════════════════════════════════════
// Tests — mode test de l'administratrice (S5R2-01)
//
// Analogie : la répétition générale au théâtre. Mêmes décors, même
// texte, mêmes entrées en scène… mais la salle est vide : rien n'est
// enregistré, et on peut rejouer autant de fois qu'on veut.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';

vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

// Un MÊME objet user à chaque rendu (voir EnqueteRepondreV2.test.jsx).
// Profil volontairement rempli : en mode test, il ne doit RIEN pré-remplir.
const mockAdmin = { role: 'ADMIN', emailVerified: false, travailleASenlis: true };
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ user: mockAdmin, isLogged: true, isAdmin: true }),
}));

const { default: EnqueteRepondre } = await import('./EnqueteRepondre.jsx');
const { default: EnqueteDetail } = await import('./EnqueteDetail.jsx');

// Un BROUILLON : c'est justement ce qu'on veut pouvoir tester
const survey = {
  id: 's1', slug: 'stationnement', title: 'Stationnement', description: 'Une enquête', status: 'DRAFT',
  audience: null,
  questions: [
    { id: 'q0', order: 0, label: 'Travaillez-vous à Senlis ?', type: 'OUI_NON', required: true, conditionOptionIds: [],
      syncsToProfile: 'travailleASenlis',
      options: [{ id: 'oui', label: 'Oui', syncValue: 'true' }, { id: 'non', label: 'Non', syncValue: 'false', endsSurvey: true }] },
    { id: 'q1', order: 1, label: 'Un commentaire ?', type: 'TEXTE_LIBRE', required: false, conditionOptionIds: ['oui'], options: [] },
  ],
};

function renderAt(path, element, routePath) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={routePath} element={element} /></Routes>
    </MemoryRouter>,
  );
}

describe('Mode test admin — page de réponse', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    // hasResponded à true : ignoré en mode test (l'admin ne répond jamais pour de vrai)
    api.get.mockResolvedValue({ survey, hasResponded: true });
  });

  it('un brouillon se teste : bandeau « Mode test », sans pré-remplissage du profil', async () => {
    renderAt('/enquetes/stationnement/repondre', <EnqueteRepondre />, '/enquetes/:slug/repondre');
    await screen.findByText('Travaillez-vous à Senlis ?', { selector: 'h2 *, h2' });

    expect(screen.getByRole('status')).toHaveTextContent(/Mode test.*rien n'est enregistré.*brouillon/);
    // Pas de lecture seule « Vous travaillez à Senlis : Oui » : les deux choix sont proposés
    expect(screen.getByRole('radio', { name: 'Oui' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Non' })).toBeInTheDocument();
  });

  it("l'envoi part vers /test, le récapitulatif s'affiche, et on peut recommencer", async () => {
    api.post.mockResolvedValue({
      test: true, saved: false, totalQuestions: 2, profileWouldUpdate: ['travailleASenlis'],
      path: [{ questionId: 'q0', label: 'Travaillez-vous à Senlis ?', answered: true }],
    });
    renderAt('/enquetes/stationnement/repondre', <EnqueteRepondre />, '/enquetes/:slug/repondre');
    await screen.findByText('Travaillez-vous à Senlis ?', { selector: 'h2 *, h2' });

    fireEvent.click(screen.getByRole('radio', { name: 'Non' })); // « Non » termine l'enquête
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));

    await screen.findByText('Test terminé : le parcours est valide');
    expect(api.post).toHaveBeenCalledWith('/surveys/s1/test', { answers: [{ questionId: 'q0', optionId: 'non' }] });
    expect(screen.getByText(/1 question vue sur 2/)).toBeInTheDocument();
    expect(screen.getByText(/travaille à Senlis/)).toBeInTheDocument();

    // Recommencer : retour à la question 1, réponses effacées
    fireEvent.click(screen.getByRole('button', { name: /Recommencer le test/ }));
    expect(screen.getByText('Question 1 sur 1')).toBeInTheDocument(); // q1 cachée tant que « Oui » n'est pas choisi
    expect(screen.getByRole('radio', { name: 'Non' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Mode test admin — page détail', () => {
  it("« Tester l'enquête » remplace « Répondre », même pour un brouillon", async () => {
    api.get.mockResolvedValue({ survey, hasResponded: null, inAudience: null });
    renderAt('/enquetes/stationnement', <EnqueteDetail />, '/enquetes/:slug');

    expect(await screen.findByRole('button', { name: /Tester l'enquête/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Répondre/ })).not.toBeInTheDocument();
  });
});
