// ══════════════════════════════════════════════════════════
// Tests — constructeur d'enquête, réglages du moteur v2 (S5R-05)
// On remplit le formulaire comme l'administratrice, puis on vérifie
// ce qui part réellement vers l'API.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';

vi.mock('../services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn().mockResolvedValue({}), patch: vi.fn() } }));
const { default: AdminSurveyForm } = await import('./AdminSurveyForm.jsx');

const change = (el, value) => fireEvent.change(el, { target: { value } });

describe('Constructeur — moteur v2', () => {
  it("envoie conditions (OU), « Termine l'enquête », bornes et limite de cases", async () => {
    render(
      <MemoryRouter initialEntries={['/admin/enquetes/nouvelle']}>
        <Routes><Route path="/admin/enquetes/nouvelle" element={<AdminSurveyForm />} /></Routes>
      </MemoryRouter>,
    );
    change(screen.getByLabelText('Titre'), 'Stationnement 2026');
    change(screen.getByLabelText('Description'), 'Une description suffisamment longue');

    // Q1 : Oui/Non — « Non » termine l'enquête
    const [q1Label] = screen.getAllByLabelText('Intitulé');
    change(q1Label, 'Avez-vous un véhicule ?');
    change(screen.getAllByLabelText('Type de réponse')[0], 'OUI_NON');
    fireEvent.click(screen.getAllByRole('checkbox', { name: "Termine l'enquête" })[1]);

    // Q2 : Nombre, au moins 1, affichée si Q1 = Oui
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une question' }));
    change(screen.getAllByLabelText('Intitulé')[1], 'Combien de véhicules ?');
    change(screen.getAllByLabelText('Type de réponse')[1], 'NOMBRE');
    change(screen.getByLabelText('Valeur minimum (optionnel)'), '1');
    change(screen.getAllByRole('combobox', { name: 'Ajouter une condition' })[0], screen.getAllByRole('option', { name: 'Q1 : Oui' })[0].value);

    // Q3 : choix multiple limité par Q2, affichée si Q1 = Oui OU Q1 = Non (deux conditions)
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une question' }));
    change(screen.getAllByLabelText('Intitulé')[2], 'Où sont-ils garés ?');
    change(screen.getAllByLabelText('Type de réponse')[2], 'CHOIX_MULTIPLE');
    const cards = screen.getAllByText(/^Question \d$/).map((el) => el.closest('.card-joyful'));
    const q3 = within(cards[2]);
    q3.getAllByRole('textbox').slice(-2).forEach((input, i) => change(input, i === 0 ? 'Garage' : 'Rue'));
    change(q3.getByLabelText('Nombre maximum de cases cochées'), q3.getByRole('option', { name: /La réponse à Q2/ }).value);
    change(q3.getByRole('combobox', { name: 'Ajouter une condition' }), q3.getByRole('option', { name: 'Q1 : Oui' }).value);
    change(q3.getByRole('combobox', { name: 'Ajouter une condition' }), q3.getByRole('option', { name: 'Q1 : Non' }).value);

    fireEvent.submit(screen.getByLabelText('Titre').closest('form'));

    const [, payload] = api.post.mock.calls[0];
    const [p1, p2, p3] = payload.questions;
    expect(p1.options).toEqual([
      { label: 'Oui', syncValue: undefined, endsSurvey: false },
      { label: 'Non', syncValue: undefined, endsSurvey: true },
    ]);
    expect(p2).toMatchObject({ type: 'NOMBRE', minValue: 1, showIfAny: [{ questionOrder: 0, optionOrder: 0 }] });
    expect(p3).toMatchObject({
      type: 'CHOIX_MULTIPLE',
      maxChoicesFrom: { questionOrder: 1 },
      showIfAny: [{ questionOrder: 0, optionOrder: 0 }, { questionOrder: 0, optionOrder: 1 }],
    });
  });
});
