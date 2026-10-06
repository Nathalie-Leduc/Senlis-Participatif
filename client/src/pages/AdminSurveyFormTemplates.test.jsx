// ══════════════════════════════════════════════════════════
// Tests — création d'enquête simplifiée (S5R-09)
// Modèles, questions de profil, duplication, aides sous les champs.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';

vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn().mockResolvedValue({}), patch: vi.fn() } }));
const { default: AdminSurveyForm } = await import('./AdminSurveyForm.jsx');

function renderForm() {
  render(
    <MemoryRouter initialEntries={['/admin/enquetes/nouvelle']}>
      <Routes><Route path="/admin/enquetes/nouvelle" element={<AdminSurveyForm />} /></Routes>
    </MemoryRouter>,
  );
}
const submit = () => {
  fireEvent.submit(screen.getByLabelText('Titre').closest('form'));
  return api.post.mock.lastCall[1];
};

describe('Création simplifiée', () => {
  beforeEach(() => { api.post.mockClear(); vi.spyOn(window, 'confirm').mockReturnValue(true); });

  it('chaque champ principal a une aide reliée (lue par les lecteurs d’écran)', () => {
    renderForm();
    expect(screen.getByLabelText('Titre')).toHaveAccessibleDescription(/Court et concret/);
    expect(screen.getAllByLabelText('Type de réponse')[0]).toHaveAccessibleDescription(/Une seule réponse parmi une liste/);
  });

  it('modèle « Avis sur un projet » : titre, 4 questions, inquiétudes posées si défavorable (OU)', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Avis sur un projet/ }));
    expect(screen.getByLabelText('Titre')).toHaveValue('Votre avis sur le projet…');

    const payload = submit();
    expect(payload.questions).toHaveLength(4);
    expect(payload.questions[2].showIfAny).toEqual([{ questionOrder: 1, optionOrder: 2 }, { questionOrder: 1, optionOrder: 3 }]);
  });

  it('modèle « Habitudes de déplacement » : fin anticipée, minimum, cases limitées', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Habitudes de déplacement/ }));
    const [, q2, q3, q4] = submit().questions;
    expect(q2.options[1]).toMatchObject({ label: 'Non', endsSurvey: true });
    expect(q3).toMatchObject({ type: 'NOMBRE', minValue: 1, showIfAny: [{ questionOrder: 1, optionOrder: 0 }] });
    expect(q4.maxChoicesFrom).toEqual({ questionOrder: 2 });
  });

  it('questions de profil insérées en tête, synchronisées avec le profil, une seule fois', () => {
    renderForm();
    const button = screen.getByRole('button', { name: '+ Insérer les questions de profil' });
    fireEvent.click(button);
    expect(button).toBeDisabled();

    const [residence, quartier, travaille] = submit().questions;
    expect(residence).toMatchObject({ syncsToProfile: 'situation' });
    expect(residence.options.map((o) => o.syncValue)).toEqual(['CENTRE_RESIDENT', 'AUTRE_QUARTIER', 'HORS_SENLIS']);
    expect(quartier.showIfAny).toEqual([{ questionOrder: 0, optionOrder: 1 }]);
    expect(travaille.options.map((o) => o.syncValue)).toEqual(['true', 'false']);
  });

  it('dupliquer une question : copie juste après, options indépendantes', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Sondage rapide/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer la question 1' }));

    const labels = screen.getAllByLabelText('Intitulé').map((input) => input.value);
    expect(labels).toEqual(['Êtes-vous pour … ?', 'Êtes-vous pour … ? (copie)', 'Un commentaire ?']);

    // Modifier une option de la copie ne touche pas l'original
    const optionInputs = screen.getAllByPlaceholderText('Oui');
    fireEvent.change(optionInputs[1], { target: { value: 'Plutôt oui' } });
    const [original, copy] = submit().questions;
    expect(original.options[0].label).toBe('Oui');
    expect(copy.options[0].label).toBe('Plutôt oui');
  });
});

// ── Correctif du 03/10 : le lien avec le profil, réglage avancé ──
describe('Relier une réponse au profil (réglage avancé)', () => {
  beforeEach(() => { api.post.mockClear(); vi.spyOn(window, 'confirm').mockReturnValue(true); });

  it("est replié par défaut sur une question sans rapport (« Connaissiez-vous ce projet ? »)", () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Avis sur un projet/ }));
    const details = screen.getAllByText(/Réglage avancé : relier la réponse au profil/)[0].closest('details');
    expect(details).not.toHaveAttribute('open');
  });

  it('cocher donne un retour immédiat, et prévient si l’intitulé ne correspond pas', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Avis sur un projet/ }));
    const [checkbox] = screen.getAllByRole('checkbox', { name: /la personne travaille, ou non, à Senlis/ });
    fireEvent.click(checkbox);

    expect(screen.getByText(/Rien ne change au moment/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/ne semble pas parler de « travaille à Senlis »/);
  });

  it('pas d’avertissement quand l’intitulé correspond (questions de profil insérées : ouvertes et cohérentes)', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '+ Insérer les questions de profil' }));
    const opened = screen.getAllByText(/Réglage avancé/).map((el) => el.closest('details')).filter((d) => d.hasAttribute('open'));
    expect(opened).toHaveLength(5); // les 5 questions de profil sont reliées
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ── Retour du 03/10 : choisir l'emplacement (après duplication) ──
describe('Déplacer une question', () => {
  beforeEach(() => { api.post.mockClear(); vi.spyOn(window, 'confirm').mockReturnValue(true); });
  const labels = () => screen.getAllByLabelText('Intitulé').map((input) => input.value);

  it('la copie d’une question peut être placée en 3, 4…', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Avis sur un projet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer la question 1' }));
    expect(labels()[1]).toMatch(/\(copie\)$/);

    // La copie (position 2) part en dernière position (5)
    fireEvent.change(screen.getByLabelText('Position de la question 2'), { target: { value: '4' } });
    expect(labels()[4]).toMatch(/Connaissiez-vous ce projet avant cette enquête \? \(copie\)/);
  });

  it('seules les positions qui respectent les conditions sont proposées, avec l’explication', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Avis sur un projet/ }));
    // Q3 « Qu'est-ce qui vous inquiète ? » dépend de Q2 : elle ne peut pas monter en 1 ou 2
    const select = screen.getByLabelText('Position de la question 3');
    const positions = [...select.options].map((o) => Number(o.value) + 1);
    expect(positions).toEqual([3, 4]);
    expect(select).toHaveAccessibleDescription(/dépend de la question 2/);

    // Et Q2 ne peut pas descendre après Q3, qui dépend d'elle
    const q2 = [...screen.getByLabelText('Position de la question 2').options].map((o) => Number(o.value) + 1);
    expect(q2).toEqual([1, 2]);
  });
});

// ── Retour du 03/10 : suggestions de villes ──
describe('Suggestions de villes (réglage avancé)', () => {
  beforeEach(() => { api.post.mockClear(); vi.spyOn(window, 'confirm').mockReturnValue(true); });

  it("repliées sur « Qu'est-ce qui vous inquiète ? », et signalées si on les active quand même", () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Avis sur un projet/ }));
    const summary = screen.getAllByText(/proposer des noms de villes/)[0];
    expect(summary.closest('details')).not.toHaveAttribute('open');

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Proposer des villes françaises' })[0]);
    expect(screen.getByRole('alert')).toHaveTextContent(/ne semble pas demander une ville/);
  });
});

// ── Retour du 03/10 : annuler l'insertion des questions de profil ──
describe('Retirer les questions de profil', () => {
  beforeEach(() => { api.post.mockClear(); vi.spyOn(window, 'confirm').mockReturnValue(true); });
  const labels = () => screen.getAllByLabelText('Intitulé').map((input) => input.value);

  it("retire d'un coup les 5 questions insérées et réactive le bouton d'insertion", () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Sondage rapide/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ Insérer les questions de profil' }));
    expect(labels()).toHaveLength(7);

    fireEvent.click(screen.getByRole('button', { name: 'Retirer les questions de profil' }));
    expect(labels()).toEqual(['Êtes-vous pour … ?', 'Un commentaire ?']);
    expect(screen.getByRole('button', { name: '+ Insérer les questions de profil' })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Retirer les questions de profil' })).toBeNull();
  });

  it("prévient quand d'autres questions en dépendent, et nettoie leurs conditions", () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '+ Insérer les questions de profil' }));
    // Nouvelle question, affichée si Q1 = « Le centre historique »
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une question' }));
    fireEvent.change(screen.getAllByLabelText('Intitulé')[5], { target: { value: 'Une question pour le centre' } });
    const add = screen.getAllByRole('combobox', { name: 'Ajouter une condition' }).at(-1);
    fireEvent.change(add, { target: { value: screen.getAllByRole('option', { name: 'Q1 : Le centre historique' }).at(-1).value } });

    fireEvent.click(screen.getByRole('button', { name: 'Retirer les questions de profil' }));
    expect(window.confirm).toHaveBeenLastCalledWith(expect.stringMatching(/1 autre question en dépend/));

    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Enquête de test' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Une description suffisamment longue' } });
    const [only] = submit().questions;
    expect(only.label).toBe('Une question pour le centre');
    expect(only.showIfAny).toBeUndefined();
  });

  it("annuler la confirmation ne retire rien", () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '+ Insérer les questions de profil' }));
    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer les questions de profil' }));
    expect(labels()).toHaveLength(5);
  });
});

// ── Retour du 03/10 : voir le modèle choisi ──
describe('Modèle choisi', () => {
  beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });

  it('le modèle appliqué est mis en valeur et annoncé ; un autre choix le remplace', () => {
    renderForm();
    const avis = screen.getByRole('button', { name: /Avis sur un projet/ });
    fireEvent.click(avis);
    expect(avis).toHaveAttribute('aria-pressed', 'true');
    expect(avis).toHaveTextContent('Modèle appliqué');
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Modèle « Avis sur un projet » appliqué : 4 questions ci-dessous.');

    const sondage = screen.getByRole('button', { name: /Sondage rapide/ });
    fireEvent.click(sondage);
    expect(sondage).toHaveAttribute('aria-pressed', 'true');
    expect(avis).toHaveAttribute('aria-pressed', 'false');
  });

  it('refuser la confirmation ne change pas le modèle mis en valeur', () => {
    renderForm();
    const avis = screen.getByRole('button', { name: /Avis sur un projet/ });
    fireEvent.click(avis);
    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: /Sondage rapide/ }));
    expect(avis).toHaveAttribute('aria-pressed', 'true');
  });
});
