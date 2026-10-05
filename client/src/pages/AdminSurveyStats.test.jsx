// ══════════════════════════════════════════════════════════
// Tests — résultats détaillés (S5R-08) : public → question → export
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../services/api.js';
import { downloadText } from '../utils/download.js';

vi.mock('../services/api.js', () => ({ api: { get: vi.fn() } }));
vi.mock('../utils/download.js', () => ({ downloadText: vi.fn() }));
const { default: AdminSurveyStats } = await import('./AdminSurveyStats.jsx');

const EMPTY = { situations: [], quartiers: [], workQuartiers: [], workTypes: [] };
const globalResults = {
  survey: { id: 's1', slug: 'stationnement', title: 'Stationnement' },
  totalResponses: 12, audience: { ...EMPTY, situations: ['CENTRE_RESIDENT'] }, audienceIsEveryone: false,
  filter: { scope: 'all' }, minGroupSize: 5, situationBreakdown: { CENTRE_RESIDENT: 8, HORS_SENLIS: 4 },
  questions: [
    { id: 'q1', label: 'Satisfait·e ?', type: 'OUI_NON', totalForQuestion: 12, conditionOptionIds: [],
      options: [{ id: 'o1', label: 'Oui', count: 9, percentage: 75 }, { id: 'o2', label: 'Non', count: 3, percentage: 25 }] },
    { id: 'q2', label: 'Combien de véhicules ?', type: 'NOMBRE', totalForQuestion: 3, conditionOptionIds: ['o2'],
      stats: { count: 3, average: 1.5, min: 1, max: 2 } },
  ],
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/enquetes/s1/stats']}>
      <Routes><Route path="/admin/enquetes/:id/stats" element={<AdminSurveyStats />} /></Routes>
    </MemoryRouter>,
  );
}

describe('Résultats détaillés', () => {
  beforeEach(() => { api.get.mockReset(); downloadText.mockReset(); });

  it('affiche les résultats en barres, avec nombre et pourcentage en texte', async () => {
    api.get.mockResolvedValue(globalResults);
    renderPage();
    const card = (await screen.findByRole('heading', { name: /Satisfait/ })).closest('article');
    expect(within(card).getByText('Oui').closest('li')).toHaveTextContent('Oui9 (75 %)');
    expect(screen.getByText(/Posée si « Satisfait·e \? » = « Non »/)).toBeInTheDocument();
  });

  it('filtre par profils choisis : la requête porte les critères ; un groupe trop petit est masqué', async () => {
    api.get.mockResolvedValueOnce(globalResults).mockResolvedValueOnce({
      ...globalResults, masked: true, totalResponses: null, questions: [], filter: { scope: 'custom' },
    });
    renderPage();
    await screen.findByRole('heading', { name: /Satisfait/ });

    fireEvent.click(screen.getByRole('radio', { name: 'Des profils choisis…' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Personnes qui résident hors de Senlis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer ce filtre' }));

    expect(await screen.findByText(/Moins de 5 répondants correspondent/)).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith('/surveys/s1/stats?scope=custom&situations=HORS_SENLIS');
    expect(screen.getByRole('button', { name: 'Exporter (Excel, CSV)' })).toBeDisabled();
  });

  it("« le public visé de l'enquête » en un clic", async () => {
    api.get.mockResolvedValue(globalResults);
    renderPage();
    await screen.findByRole('heading', { name: /Satisfait/ });
    fireEvent.click(screen.getByRole('radio', { name: "Le public visé de l'enquête" }));
    expect(api.get).toHaveBeenLastCalledWith('/surveys/s1/stats?scope=target');
  });

  it('une seule question, puis export CSV de ce qui est affiché', async () => {
    api.get.mockResolvedValue(globalResults);
    renderPage();
    await screen.findByRole('heading', { name: /Satisfait/ });

    fireEvent.change(screen.getByLabelText('② Question'), { target: { value: 'q2' } });
    expect(screen.queryByRole('heading', { name: /Satisfait/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Exporter (Excel, CSV)' }));
    const [csv, filename] = downloadText.mock.calls[0];
    expect(filename).toMatch(/^resultats-stationnement-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain('Combien de véhicules ?');
    expect(csv).not.toContain('Satisfait');
  });
});
