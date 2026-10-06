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
