// ══════════════════════════════════════════════════════════
// Tests — graphiques des résultats (S5R2-04)
// (Chart.js est remplacé par une doublure dans test-setup.js : on
// vérifie CE QUI serait dessiné.)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ResultChart from './ResultChart.jsx';
import {
  SLICE_COLORS, NO_ANSWER_COLOR, canShowPie, noAnswerCount, wrapLabel,
} from '../../utils/resultChartRules.js';
import { api } from '../../services/api.js';

vi.mock('../../services/api.js', () => ({ api: { get: vi.fn() } }));

// Question à 3 choix, réponse unique : 10 personnes l'ont vue, 8 ont répondu
const modes = {
  id: 'q1', label: 'Comment venez-vous le plus souvent ?', type: 'CHOIX_UNIQUE', totalForQuestion: 10,
  options: [
    { id: 'a', label: 'À pied', count: 5, percentage: 50 },
    { id: 'b', label: 'Voiture', count: 2, percentage: 20 },
    { id: 'c', label: 'Vélo', count: 1, percentage: 10 },
  ],
};
const data = (testId, key) => JSON.parse(screen.getByTestId(testId).getAttribute(`data-${key}`));

describe('Règles des graphiques', () => {
  it('secteurs : réponse unique, 3 à 5 options, aucune option conditionnelle', () => {
    expect(canShowPie(modes)).toBe(true);
    expect(canShowPie({ ...modes, type: 'CHOIX_MULTIPLE' })).toBe(false); // la somme dépasse 100 %
    expect(canShowPie({ ...modes, options: modes.options.slice(0, 2) })).toBe(false); // 2 parts : barres
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `o${i}`, label: `O${i}`, count: 1, percentage: 10 }));
    expect(canShowPie({ ...modes, options: six })).toBe(false); // trop de parts
    const conditional = modes.options.map((o, i) => (i === 2 ? { ...o, offeredTo: 4 } : o));
    expect(canShowPie({ ...modes, options: conditional })).toBe(false);
  });

  it('« Sans réponse » = personnes concernées − réponses', () => {
    expect(noAnswerCount(modes)).toBe(2);
    expect(noAnswerCount({ ...modes, totalForQuestion: 8 })).toBe(0);
  });

  it('les intitulés longs passent à la ligne sans couper les mots', () => {
    expect(wrapLabel('Pour faire des courses ou des achats en centre-ville', 20))
      .toEqual(['Pour faire des', 'courses ou des', 'achats en', 'centre-ville']);
    expect(wrapLabel('Oui')).toEqual(['Oui']);
  });

  it('5 couleurs fixes, distinctes du gris « Sans réponse »', () => {
    expect(new Set(SLICE_COLORS).size).toBe(5);
    expect(SLICE_COLORS).not.toContain(NO_ANSWER_COLOR);
  });
});

describe('ResultChart', () => {
  it('par défaut : barres des pourcentages, décrites, et tableau des nombres', () => {
    render(<ResultChart question={modes} />);
    expect(data('chart-bar', 'values')).toEqual([50, 20, 10]);
    expect(data('chart-bar', 'labels')).toEqual([['À pied'], ['Voiture'], ['Vélo']]);
    expect(screen.getByRole('img', { name: /^Diagramme en barres : À pied 50 %, Voiture 20 %, Vélo 10 %/ })).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'À pied' }).closest('tr')).toHaveTextContent('À pied550 %');
  });

  it('« Secteurs » : parts en couleurs fixes + part grise « Sans réponse », pastilles dans le tableau', () => {
    render(<ResultChart question={modes} />);
    const pie = screen.getByRole('button', { name: 'Secteurs' });
    fireEvent.click(pie);
    expect(pie).toHaveAttribute('aria-pressed', 'true');

    expect(data('chart-doughnut', 'labels')).toEqual(['À pied', 'Voiture', 'Vélo', 'Sans réponse']);
    expect(data('chart-doughnut', 'values')).toEqual([5, 2, 1, 2]);
    expect(data('chart-doughnut', 'colors')).toEqual([...SLICE_COLORS.slice(0, 3), NO_ANSWER_COLOR]);
    expect(screen.getByRole('img', { name: /^Diagramme en secteurs/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Sans réponse' }).closest('tr')).toHaveTextContent('Sans réponse220 %');
  });

  it('pas de choix « Secteurs » quand ils mentiraient (choix multiples)', () => {
    render(<ResultChart question={{ ...modes, type: 'CHOIX_MULTIPLE' }} />);
    expect(screen.queryByRole('button', { name: 'Secteurs' })).toBeNull();
    expect(screen.getByTestId('chart-bar')).toBeInTheDocument();
  });

  it('les pourcentages s’écrivent à la française (virgule)', () => {
    render(<ResultChart question={{ ...modes, options: [{ id: 'a', label: 'Oui', count: 1, percentage: 33.3 }, ...modes.options.slice(1)] }} />);
    expect(screen.getByRole('rowheader', { name: 'Oui' }).closest('tr')).toHaveTextContent('33,3 %');
  });
});

describe('Page publique des résultats', () => {
  it('affiche le graphique et le tableau de chaque question à choix', async () => {
    const { default: EnqueteResultats } = await import('../../pages/EnqueteResultats.jsx');
    api.get.mockResolvedValue({ survey: { title: 'Venir au centre' }, totalResponses: 10, questions: [modes] });
    render(
      <MemoryRouter initialEntries={['/enquetes/venir/resultats']}>
        <Routes><Route path="/enquetes/:slug/resultats" element={<EnqueteResultats />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('chart-bar')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Voiture' })).toBeInTheDocument();
  });
});

// ── Garde-fou : Chart.js n'est chargé QUE sur les pages de résultats ──
// (~58 ko compressés : le reste du site ne doit pas les télécharger). Seul
// ResultChart importe Chart.js, et seules les deux pages de résultats
// importent ResultChart — chargées à la demande par React.lazy.
describe('Chart.js chargé seulement sur les pages de résultats', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const sources = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(name) && !/\.test\.jsx?$/.test(name) && name !== 'test-setup.js') sources.push(full);
    }
  }(SRC));
  const importing = (pattern) => sources
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(SRC, file).replaceAll(path.sep, '/'))
    .sort();

  it('seul ResultChart importe chart.js / react-chartjs-2', () => {
    expect(importing(/from ['"](chart\.js|react-chartjs-2)['"]/)).toEqual(['components/ResultChart/ResultChart.jsx']);
  });

  it('seules les pages de résultats importent ResultChart, et App les charge à la demande', () => {
    expect(importing(/ResultChart\/ResultChart\.jsx['"]/)).toEqual(['pages/AdminSurveyStats.jsx', 'pages/EnqueteResultats.jsx']);
    const app = readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
    expect(app).toMatch(/lazy\(\(\) => import\('\.\/pages\/EnqueteResultats\.jsx'\)\)/);
    expect(app).toMatch(/lazy\(\(\) => import\('\.\/pages\/AdminSurveyStats\.jsx'\)\)/);
  });
});
