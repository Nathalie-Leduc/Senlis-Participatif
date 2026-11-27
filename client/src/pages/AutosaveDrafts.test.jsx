// ══════════════════════════════════════════════════════════
// Tests — sauvegarde automatique des saisies en cours (S5R2-13)
//
// Chaque scénario « quitte la page » en démontant le composant
// (unmount), puis « revient » en le remontant : exactement ce qui se
// passe quand on clique sur un autre menu puis qu'on revient.
// Analogie : on ferme le livre, on le rouvre — le marque-page est-il là ?
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';
import { loadDraft } from '../utils/draftStorage.js';

// Compte connecté : modifiable d'un test à l'autre. Un MÊME objet par
// rôle (la page de réponse recharge l'enquête quand `user` change).
const ADMIN = { id: 'u-admin', role: 'ADMIN', emailVerified: true };
const CITIZEN = { id: 'u-cit', role: 'CITIZEN', emailVerified: true, travailleASenlis: null };
let currentUser = ADMIN;
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: currentUser,
    isLogged: true,
    isAdmin: currentUser.role === 'ADMIN',
    isEditor: false,
    isStaff: currentUser.role !== 'CITIZEN',
  }),
}));
vi.mock('../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  assetUrl: (p) => p,
}));
vi.mock('../components/MapView/LazyMapView.jsx', () => ({ default: () => <div data-testid="map" /> }));
vi.mock('../utils/irisData.js', () => ({ loadIris: () => Promise.resolve(null) }));
// Les confettis de l'écran « Merci » utilisent matchMedia, absent de jsdom
vi.mock('../components/Confetti/Confetti.jsx', () => ({ default: () => null }));

const { default: AdminSurveyForm } = await import('./AdminSurveyForm.jsx');
const { default: AdminPropositionForm } = await import('./AdminPropositionForm.jsx');
const { default: EnqueteRepondre, restoreAnswers, resumeStep } = await import('./EnqueteRepondre.jsx');

function renderAt(path, routePath, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        <Route path="/admin/enquetes" element={<p>liste des enquêtes</p>} />
        <Route path="/admin/propositions" element={<p>liste des propositions</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const newSurvey = () => renderAt('/admin/enquetes/nouvelle', '/admin/enquetes/nouvelle', <AdminSurveyForm />);
const newProposal = () => renderAt('/admin/propositions/nouvelle', '/admin/propositions/nouvelle', <AdminPropositionForm />);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  currentUser = ADMIN;
});

describe('Admin — nouvelle enquête', () => {
  it('ouvrir puis quitter un formulaire vide ne laisse aucun brouillon', () => {
    const { unmount } = newSurvey();
    unmount();
    expect(loadDraft(ADMIN.id, 'survey-form:new')).toBeNull();
    newSurvey();
    expect(screen.queryByText(/saisie non enregistrée/)).toBeNull();
  });

  it('quitter en cours de route, revenir, « Reprendre ma saisie » : tout est là', () => {
    const { unmount } = newSurvey();
    fireEvent.change(screen.getByLabelText('Titre'), { target: { name: 'title', value: 'Stationnement 2027' } });
    fireEvent.change(screen.getAllByLabelText('Intitulé')[0], { target: { value: 'Avez-vous une voiture ?' } });
    unmount(); // l'admin clique sur un autre menu

    newSurvey(); // … puis revient
    expect(screen.getByRole('heading', { name: /saisie non enregistrée/ })).toHaveFocus();
    expect(screen.queryByLabelText('Titre')).toBeNull(); // le choix d'abord

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre ma saisie' }));
    expect(screen.getByLabelText('Titre')).toHaveValue('Stationnement 2027');
    expect(screen.getAllByLabelText('Intitulé')[0]).toHaveValue('Avez-vous une voiture ?');
  });

  it('« Repartir de zéro » : formulaire vide, brouillon effacé', () => {
    const { unmount } = newSurvey();
    fireEvent.change(screen.getByLabelText('Titre'), { target: { name: 'title', value: 'À oublier' } });
    unmount();

    newSurvey();
    fireEvent.click(screen.getByRole('button', { name: 'Repartir de zéro' }));
    expect(screen.getByLabelText('Titre')).toHaveValue('');
    expect(loadDraft(ADMIN.id, 'survey-form:new')).toBeNull();
  });

  it('le modèle choisi est gardé lui aussi', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { unmount } = newSurvey();
    fireEvent.click(screen.getByRole('button', { name: /Sondage rapide/ }));
    unmount();

    newSurvey();
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre ma saisie' }));
    expect(screen.getByRole('button', { name: /Sondage rapide/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('une fois l’enquête enregistrée, le brouillon disparaît', async () => {
    api.post.mockResolvedValue({ survey: { id: 's1' } });
    newSurvey();
    fireEvent.change(screen.getByLabelText('Titre'), { target: { name: 'title', value: 'Enquête complète' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { name: 'description', value: 'Une description assez longue' } });
    fireEvent.change(screen.getAllByLabelText('Intitulé')[0], { target: { value: 'Une question ?' } });
    expect(loadDraft(ADMIN.id, 'survey-form:new')).not.toBeNull();

    fireEvent.submit(screen.getByLabelText('Titre').closest('form'));
    await screen.findByText('liste des enquêtes');
    expect(loadDraft(ADMIN.id, 'survey-form:new')).toBeNull();
  });
});

describe('Admin — proposition', () => {
  it('reprise d’une proposition commencée, en prévenant que l’image n’est pas gardée', () => {
    const { unmount } = newProposal();
    fireEvent.change(screen.getByLabelText(/^Titre/), { target: { name: 'title', value: 'Des bancs place Henri IV' } });
    unmount();

    newProposal();
    expect(screen.getByText(/L'image n'est pas gardée/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre ma saisie' }));
    expect(screen.getByLabelText(/^Titre/)).toHaveValue('Des bancs place Henri IV');
  });

  it('en modification : brouillon propre à CETTE proposition, proposé après le chargement', async () => {
    api.get.mockResolvedValue({
      proposal: { id: 'p1', title: 'Titre en base', summary: 'Accroche en base', content: 'Argumentaire en base assez long', status: 'DRAFT' },
    });
    const edit = () => renderAt('/admin/propositions/bancs/modifier', '/admin/propositions/:slug/modifier', <AdminPropositionForm />);

    const { unmount } = edit();
    fireEvent.change(await screen.findByDisplayValue('Titre en base'), { target: { name: 'title', value: 'Titre modifié' } });
    unmount();
    expect(loadDraft(ADMIN.id, 'proposal-form:bancs').data.form.title).toBe('Titre modifié');
    expect(loadDraft(ADMIN.id, 'proposal-form:new')).toBeNull();

    edit();
    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre ma saisie' }));
    expect(screen.getByLabelText(/^Titre/)).toHaveValue('Titre modifié');
  });
});

// ── Citoyen : réponses à une enquête ──────────────────────
const survey = {
  id: 's1', slug: 'velo', title: 'Vélo', status: 'OPEN',
  questions: [
    { id: 'q0', order: 0, label: 'Avez-vous un vélo ?', type: 'OUI_NON', required: true, conditionOptionIds: [],
      options: [{ id: 'oui', label: 'Oui' }, { id: 'non', label: 'Non' }] },
    { id: 'q1', order: 1, label: 'Combien ?', type: 'NOMBRE', required: true, conditionOptionIds: ['oui'], options: [] },
    { id: 'q2', order: 2, label: 'Un commentaire ?', type: 'TEXTE_LIBRE', required: false, conditionOptionIds: [], options: [] },
  ],
};
const answerPage = () => renderAt('/enquetes/velo/repondre', '/enquetes/:slug/repondre', <EnqueteRepondre />);
const heading = (text) => screen.findByText(text, { selector: 'h2 *, h2' });

describe('Citoyen — réponses commencées', () => {
  beforeEach(() => {
    currentUser = CITIZEN;
    api.get.mockResolvedValue({ survey, hasResponded: false });
  });

  it('reprend à la question atteinte, avec les réponses précédentes, et « Précédent » marche toujours', async () => {
    const { unmount } = answerPage();
    await heading('Avez-vous un vélo ?');
    fireEvent.click(screen.getByRole('radio', { name: 'Oui' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.change(await screen.findByRole('spinbutton'), { target: { value: '2' } });
    unmount(); // la personne quitte la page

    answerPage(); // … et revient
    expect(await heading('Combien ?')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
    expect(screen.getByRole('status')).toHaveTextContent(/Nous avons repris vos réponses du/);

    fireEvent.click(screen.getByRole('button', { name: /Précédent/ }));
    expect(screen.getByRole('radio', { name: 'Oui' })).toHaveAttribute('aria-checked', 'true');
  });

  it('« Recommencer à zéro » : question 1, réponses effacées', async () => {
    const { unmount } = answerPage();
    await heading('Avez-vous un vélo ?');
    fireEvent.click(screen.getByRole('radio', { name: 'Oui' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    unmount();

    answerPage();
    await heading('Combien ?');
    fireEvent.click(screen.getByRole('button', { name: 'Recommencer à zéro' }));
    expect(await heading('Avez-vous un vélo ?')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Oui' })).toHaveAttribute('aria-checked', 'false');
    expect(loadDraft(CITIZEN.id, 'survey-answers:s1')).toBeNull();
  });

  it('après l’envoi, plus rien n’est gardé', async () => {
    api.post.mockResolvedValue({});
    answerPage();
    await heading('Avez-vous un vélo ?');
    fireEvent.click(screen.getByRole('radio', { name: 'Non' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    await heading('Un commentaire ?');
    expect(loadDraft(CITIZEN.id, 'survey-answers:s1')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    await screen.findByText('Merci pour votre participation !');
    expect(loadDraft(CITIZEN.id, 'survey-answers:s1')).toBeNull();
  });

  it('mode test (admin) : rien n’est jamais gardé', async () => {
    currentUser = ADMIN;
    answerPage();
    await heading('Avez-vous un vélo ?');
    fireEvent.click(screen.getByRole('radio', { name: 'Oui' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    await waitFor(() => expect(screen.getByRole('spinbutton')).toBeInTheDocument());
    expect(localStorage.length).toBe(0);
  });
});

describe('Remise en place des réponses (fonctions pures)', () => {
  it('restoreAnswers ne garde que les questions et options qui existent encore', () => {
    expect(restoreAnswers(survey, {
      q0: { optionId: 'oui' },
      q1: { valueNumber: 3 },
      q2: { valueText: 'Super' },
      disparue: { optionId: 'x' },
    })).toEqual({ q0: { optionId: 'oui' }, q1: { valueNumber: 3 }, q2: { valueText: 'Super' } });
    expect(restoreAnswers(survey, { q0: { optionId: 'option-retiree' } })).toEqual({});
    expect(restoreAnswers(survey, null)).toEqual({});
  });

  it('resumeStep ne dépasse jamais la dernière question visible', () => {
    // « Non » : q1 cachée → 2 questions visibles (q0, q2) → au plus l'étape 1
    expect(resumeStep(survey, { q0: { optionId: 'non' } }, 5)).toBe(1);
    expect(resumeStep(survey, { q0: { optionId: 'oui' } }, 2)).toBe(2);
    expect(resumeStep(survey, {}, undefined)).toBe(0);
  });
});
