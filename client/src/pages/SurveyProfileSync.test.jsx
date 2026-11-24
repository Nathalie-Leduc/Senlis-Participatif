// ══════════════════════════════════════════════════════════
// Tests — questionnaire et profil (recette du 24/11)
//
// Scénario remonté : le profil dit « J'habite un autre quartier »,
// la personne clique « Modifier » à « Où résidez-vous ? » et choisit
// « Le Centre historique ». Deux défauts :
//  1. en revenant sur la question, l'ANCIENNE valeur du profil
//     s'affichait (lecture seule), comme si rien n'avait changé ;
//  2. après l'envoi, « Mon compte » montrait toujours l'ancien profil
//     (gardé en mémoire dans le navigateur jusqu'au rechargement).
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';

vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

// Contexte d'authentification simulé : refreshUser remplace l'objet
// user par un NOUVEL objet (comme le vrai contexte après /auth/me)
const auth = vi.hoisted(() => ({ user: null, refreshUser: null }));
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ user: auth.user, refreshUser: auth.refreshUser }),
}));

// Les confettis de l'écran de fin interrogent matchMedia (absent de jsdom)
window.matchMedia = window.matchMedia || ((query) => ({
  matches: false, media: query, addEventListener() {}, removeEventListener() {},
}));

const { default: EnqueteRepondre, changesProfile } = await import('./EnqueteRepondre.jsx');

const PROFILE = { id: 'u1', emailVerified: true, situation: 'AUTRE_QUARTIER', quartier: 'BRICHEBAY' };

const q0 = {
  id: 'q0', order: 0, label: 'Où résidez-vous ?', type: 'CHOIX_UNIQUE', required: true,
  syncsToProfile: 'situation', conditionOptionIds: [],
  options: [
    { id: 'centre', label: 'Le Centre historique', syncValue: 'CENTRE_HISTORIQUE' },
    { id: 'autre', label: 'Un autre quartier de Senlis', syncValue: 'AUTRE_QUARTIER' },
    { id: 'ville', label: 'Une autre ville', syncValue: 'HORS_SENLIS' },
  ],
};
const q1 = {
  id: 'q1', order: 1, label: 'Un commentaire ?', type: 'TEXTE_LIBRE', required: false,
  conditionOptionIds: [], options: [],
};
const survey = { id: 's1', slug: 'stationnement', title: 'Stationnement', status: 'OPEN', questions: [q0, q1] };

function renderSurvey() {
  return render(
    <MemoryRouter initialEntries={['/enquetes/stationnement/repondre']}>
      <Routes><Route path="/enquetes/:slug/repondre" element={<EnqueteRepondre />} /></Routes>
    </MemoryRouter>,
  );
}

describe('Questionnaire et profil (recette du 24/11)', () => {
  beforeEach(() => {
    localStorage.clear();
    auth.user = { ...PROFILE };
    auth.refreshUser = vi.fn(async () => {
      auth.user = { ...PROFILE, situation: 'CENTRE_HISTORIQUE', quartier: null };
    });
    api.get = vi.fn(async () => ({ survey, hasResponded: false }));
    api.post = vi.fn(async () => ({ response: { id: 'r1' } }));
  });

  it('la réponse modifiée reste affichée quand on revient sur la question', async () => {
    renderSurvey();
    // Au départ : la valeur du profil, en lecture seule
    expect(await screen.findByText('Un autre quartier de Senlis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Modifier/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Le Centre historique' }));
    expect(screen.getByText(/sera mis à jour avec cette réponse quand vous enverrez/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    await screen.findByText('Un commentaire ?', { selector: 'h2 *, h2' });
    fireEvent.click(screen.getByRole('button', { name: /Précédent/ }));

    // Retour : le champ montre « Centre historique » coché, pas l'ancien profil
    const centre = await screen.findByRole('radio', { name: 'Le Centre historique' });
    expect(centre).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: /Modifier/ })).toBeNull();
  });

  it("après l'envoi : profil rafraîchi, message affiché, et pas de « déjà répondu »", async () => {
    const view = renderSurvey();
    await screen.findByText('Un autre quartier de Senlis');
    fireEvent.click(screen.getByRole('button', { name: /Modifier/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Le Centre historique' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    await screen.findByText('Un commentaire ?', { selector: 'h2 *, h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));

    expect(await screen.findByText('Merci pour votre participation !')).toBeInTheDocument();
    expect(screen.getByText(/Votre profil a aussi été mis à jour/)).toBeInTheDocument();
    expect(auth.refreshUser).toHaveBeenCalledTimes(1);

    // Le contexte publie le nouveau profil (nouvel objet user) : la page
    // ne doit PAS recharger l'enquête (qui répondrait « déjà répondu »)
    view.rerender(
      <MemoryRouter initialEntries={['/enquetes/stationnement/repondre']}>
        <Routes><Route path="/enquetes/:slug/repondre" element={<EnqueteRepondre />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Merci pour votre participation !')).toBeInTheDocument());
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/déjà répondu/)).toBeNull();
  });

  it('réponse identique au profil : pas de rafraîchissement ni de message', async () => {
    renderSurvey();
    await screen.findByText('Un autre quartier de Senlis');
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    await screen.findByText('Un commentaire ?', { selector: 'h2 *, h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));

    expect(await screen.findByText('Merci pour votre participation !')).toBeInTheDocument();
    expect(screen.queryByText(/Votre profil a aussi été mis à jour/)).toBeNull();
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });
});

describe('changesProfile', () => {
  it('vrai seulement si la réponse diffère du profil', () => {
    expect(changesProfile(q0, { optionId: 'centre' }, PROFILE)).toBe(true);
    expect(changesProfile(q0, { optionId: 'autre' }, PROFILE)).toBe(false);
    expect(changesProfile(q0, undefined, PROFILE)).toBe(false);
    expect(changesProfile(q1, { valueText: 'x' }, PROFILE)).toBe(false); // question non synchronisée
    expect(changesProfile(q0, { optionId: 'centre' }, { id: 'u2', situation: null })).toBe(true); // profil vide
  });
});
