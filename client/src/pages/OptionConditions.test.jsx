// ══════════════════════════════════════════════════════════
// Tests — options conditionnelles côté navigateur (S5R2-02)
// Scénario de la recette du 08/10 : « Bus régional » proposé seulement
// aux personnes qui résident dans une autre ville.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';
import { instantiateQuestions } from '../constants/surveyTemplates.js';

let currentUser = { id: 'u-admin', role: 'ADMIN', emailVerified: true };
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ user: currentUser, isLogged: true, isAdmin: currentUser.role === 'ADMIN', isEditor: false, isStaff: currentUser.role !== 'CITIZEN' }),
}));
vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn().mockResolvedValue({}), patch: vi.fn() } }));

const { default: AdminSurveyForm } = await import('./AdminSurveyForm.jsx');
const { default: EnqueteRepondre, keepOffered } = await import('./EnqueteRepondre.jsx');
const { ResultBars } = await import('./AdminSurveyStats.jsx');

const change = (el, value) => fireEvent.change(el, { target: { value } });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  currentUser = { id: 'u-admin', role: 'ADMIN', emailVerified: true };
});

// ── Constructeur ─────────────────────────────────────────
function buildTwoQuestions() {
  render(
    <MemoryRouter initialEntries={['/admin/enquetes/nouvelle']}>
      <Routes><Route path="/admin/enquetes/nouvelle" element={<AdminSurveyForm />} /></Routes>
    </MemoryRouter>,
  );
  change(screen.getByLabelText('Titre'), 'Venir au centre');
  change(screen.getByLabelText('Description'), 'Une description suffisamment longue');
  change(screen.getAllByLabelText('Intitulé')[0], 'Où résidez-vous ?');
  change(screen.getByLabelText('Option 1 de la question 1'), 'Senlis');
  change(screen.getByLabelText('Option 2 de la question 1'), 'Autre ville');

  fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une question' }));
  change(screen.getAllByLabelText('Intitulé')[1], 'Comment venez-vous ?');
  change(screen.getAllByLabelText('Type de réponse')[1], 'CHOIX_MULTIPLE');
  change(screen.getByLabelText('Option 1 de la question 2'), 'À pied');
  change(screen.getByLabelText('Option 2 de la question 2'), 'Bus régional');
}

describe('Constructeur — « Proposer seulement si… »', () => {
  it('la condition d’une option part vers l’API (showIfAny sur l’option)', () => {
    buildTwoQuestions();
    // Pas de lien sur les options de la 1re question : rien ne la précède
    expect(screen.queryAllByRole('button', { name: /de la question 1 seulement si/ })).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Proposer « Bus régional » de la question 2 seulement si…' }));
    const select = screen.getByRole('combobox', { name: 'Ajouter une condition à « Bus régional » de la question 2' });
    change(select, within(select).getByRole('option', { name: 'Q1 : Autre ville' }).value);
    expect(screen.getByText('Q1 : Autre ville', { selector: 'span' })).toBeInTheDocument(); // la condition affichée

    fireEvent.submit(screen.getByLabelText('Titre').closest('form'));
    const [, payload] = api.post.mock.calls[0];
    expect(payload.questions[1].options[0].showIfAny).toBeUndefined();
    expect(payload.questions[1].options[1].showIfAny).toEqual([{ questionOrder: 0, optionOrder: 1 }]);
  });

  it('retirer la question déclencheuse retire aussi la condition de l’option', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    buildTwoQuestions();
    fireEvent.click(screen.getByRole('button', { name: /Proposer « Bus régional »/ }));
    const select = screen.getByRole('combobox', { name: /Ajouter une condition à « Bus régional »/ });
    change(select, within(select).getByRole('option', { name: 'Q1 : Autre ville' }).value);

    fireEvent.click(screen.getAllByRole('button', { name: 'Retirer cette question' })[0]);
    fireEvent.submit(screen.getByLabelText('Titre').closest('form'));
    const [, payload] = api.post.mock.calls[0];
    expect(payload.questions).toHaveLength(1);
    expect(payload.questions[0].options.every((o) => o.showIfAny === undefined)).toBe(true);
  });

  it('une question dont une OPTION dépend d’une autre ne peut pas remonter avant elle', () => {
    buildTwoQuestions();
    fireEvent.click(screen.getByRole('button', { name: /Proposer « Bus régional »/ }));
    const select = screen.getByRole('combobox', { name: /Ajouter une condition à « Bus régional »/ });
    change(select, within(select).getByRole('option', { name: 'Q1 : Autre ville' }).value);

    const position = screen.getByRole('combobox', { name: 'Position de la question 2' });
    expect(within(position).queryByRole('option', { name: 'Déplacer en 1' })).toBeNull();
    expect(screen.getByText(/elle dépend de la question 1/)).toBeInTheDocument();
  });
});

// ── Modèles ──────────────────────────────────────────────
describe('Modèles — option conditionnelle', () => {
  it('instantiateQuestions relie l’option à son déclencheur', () => {
    const [q0, q1] = instantiateQuestions([
      { label: 'Où résidez-vous ?', type: 'CHOIX_UNIQUE', options: [{ label: 'Senlis' }, { ref: 'ailleurs', label: 'Autre ville' }] },
      { label: 'Comment venez-vous ?', type: 'CHOIX_MULTIPLE', options: [{ label: 'À pied' }, { label: 'Bus régional', showIf: ['ailleurs'] }] },
    ], () => ({ conditions: [], options: [] }));
    expect(q1.options[1].conditions).toEqual([q0.options[1].key]);
    expect(q1.options[0].conditions).toEqual([]);
    expect(q1.options[1].showIf).toBeUndefined();
  });
});

// ── Questionnaire ────────────────────────────────────────
const survey = {
  id: 's1', slug: 'venir', title: 'Venir au centre', status: 'OPEN',
  questions: [
    { id: 'q0', order: 0, label: 'Où résidez-vous ?', type: 'CHOIX_UNIQUE', required: true, conditionOptionIds: [],
      options: [{ id: 'senlis', label: 'Senlis', conditionOptionIds: [] }, { id: 'ailleurs', label: 'Autre ville', conditionOptionIds: [] }] },
    { id: 'q1', order: 1, label: 'Comment venez-vous ?', type: 'CHOIX_MULTIPLE', required: true, conditionOptionIds: [],
      options: [{ id: 'pied', label: 'À pied', conditionOptionIds: [] }, { id: 'bus', label: 'Bus régional', conditionOptionIds: ['ailleurs'] }] },
  ],
};

describe('Questionnaire — options proposées', () => {
  beforeEach(() => {
    currentUser = { id: 'u-cit', role: 'CITIZEN', emailVerified: true };
    api.get.mockResolvedValue({ survey, hasResponded: false });
  });

  it('« Bus régional » n’apparaît que pour « Autre ville » ; revenir à « Senlis » le retire de la réponse', async () => {
    render(
      <MemoryRouter initialEntries={['/enquetes/venir/repondre']}>
        <Routes><Route path="/enquetes/:slug/repondre" element={<EnqueteRepondre />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Où résidez-vous ?', { selector: 'h2 *, h2' });

    // Senlis → pas de bus
    fireEvent.click(screen.getByRole('radio', { name: 'Senlis' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(screen.queryByRole('button', { name: /Bus régional/ })).toBeNull();

    // Retour, « Autre ville » → le bus apparaît ; on le coche
    fireEvent.click(screen.getByRole('button', { name: /Précédent/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Autre ville' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bus régional/ }));
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeEnabled();

    // Retour à « Senlis » : le bus disparaît, et la question redevient sans réponse
    fireEvent.click(screen.getByRole('button', { name: /Précédent/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Senlis' }));
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(screen.queryByRole('button', { name: /Bus régional/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeDisabled();

    // Avec « À pied », l'envoi ne contient QUE l'option proposée
    fireEvent.click(screen.getByRole('button', { name: /À pied/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    const [, payload] = api.post.mock.calls[0];
    expect(payload.answers).toEqual([
      { questionId: 'q0', optionId: 'senlis' },
      { questionId: 'q1', optionIds: ['pied'] },
    ]);
  });

  it('keepOffered garde seulement les options proposées', () => {
    const offered = new Set(['pied']);
    expect(keepOffered({ optionIds: ['pied', 'bus'] }, offered)).toEqual({ optionIds: ['pied'] });
    expect(keepOffered({ optionIds: ['bus'] }, offered)).toBeUndefined();
    expect(keepOffered({ optionId: 'bus' }, offered)).toBeUndefined();
    expect(keepOffered({ valueText: 'x' }, null)).toEqual({ valueText: 'x' });
  });
});

// ── Résultats ────────────────────────────────────────────
describe('Résultats — option conditionnelle', () => {
  it('précise à combien de personnes l’option a été proposée', () => {
    render(<ResultBars options={[
      { id: 'pied', label: 'À pied', count: 4, percentage: 66.7 },
      { id: 'bus', label: 'Bus régional', count: 1, percentage: 16.7, offeredTo: 2 },
    ]} />);
    expect(screen.getByText(/proposée à 2 personnes/)).toBeInTheDocument();
    expect(screen.getAllByText(/proposée à/)).toHaveLength(1);
  });
});
