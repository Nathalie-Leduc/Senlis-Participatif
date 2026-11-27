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
  PIE_COLORS_BY_COUNT, OTHERS_COLOR, NO_ANSWER_COLOR, canShowPie, noAnswerCount, pieSlices, wrapLabel,
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
  it('secteurs : toute question à réponse unique (recette du 14/10), jamais les choix multiples', () => {
    expect(canShowPie(modes)).toBe(true);
    expect(canShowPie({ ...modes, type: 'CHOIX_MULTIPLE' })).toBe(false); // la somme dépasse 100 %
    expect(canShowPie({ ...modes, type: 'OUI_NON', options: modes.options.slice(0, 2) })).toBe(true); // Oui / Non
    const nine = Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, label: `O${i}`, count: 1, percentage: 10 }));
    expect(canShowPie({ ...modes, options: nine })).toBe(true); // « Dans quel quartier ? »…
    const conditional = modes.options.map((o, i) => (i === 2 ? { ...o, offeredTo: 4 } : o));
    expect(canShowPie({ ...modes, options: conditional })).toBe(true); // chacun reste dans UNE part
    expect(canShowPie({ ...modes, options: modes.options.slice(0, 1) })).toBe(false);
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

  it('un ordre de couleurs par nombre de parts (1 à 8), sans doublon, neutres à part', () => {
    const all = new Set(Object.values(PIE_COLORS_BY_COUNT).flat());
    expect(all.size).toBe(8);
    for (let n = 1; n <= 8; n += 1) {
      expect(PIE_COLORS_BY_COUNT[n]).toHaveLength(n);
      expect(new Set(PIE_COLORS_BY_COUNT[n]).size).toBe(n);
    }
    expect(all.has(OTHERS_COLOR) || all.has(NO_ANSWER_COLOR)).toBe(false);
    expect(OTHERS_COLOR).not.toBe(NO_ANSWER_COLOR);
  });

  it('une option choisie par personne n’a pas de part ; les couleurs suivent les parts dessinées', () => {
    const q = { ...modes, totalForQuestion: 8, options: [...modes.options.slice(0, 2), { id: 'z', label: 'Bus', count: 0, percentage: 0 }, modes.options[2]] };
    const { slices, colorOf } = pieSlices(q);
    expect(slices.map((x) => x.label)).toEqual(['À pied', 'Voiture', 'Vélo']);
    expect(slices.map((x) => x.color)).toEqual(PIE_COLORS_BY_COUNT[3]);
    expect(colorOf.get('z')).toBeUndefined();
  });

  it('plus de 8 options choisies : les 7 plus grosses + « Autres réponses » (somme des autres)', () => {
    const counts = [9, 1, 8, 7, 2, 6, 5, 4, 3]; // 9 options
    const q = { id: 'q', label: 'Quartier', type: 'CHOIX_UNIQUE', totalForQuestion: 45, options: counts.map((count, i) => ({ id: `o${i}`, label: `Q${i}`, count, percentage: 0 })) };
    const { slices, colorOf } = pieSlices(q);
    // les deux plus petites (1 et 2) sont regroupées, l'ordre des options est gardé
    expect(slices.map((x) => x.label)).toEqual(['Q0', 'Q2', 'Q3', 'Q5', 'Q6', 'Q7', 'Q8', 'Autres réponses']);
    expect(slices.at(-1)).toEqual({ label: 'Autres réponses', count: 3, color: OTHERS_COLOR });
    expect(slices.slice(0, 7).map((x) => x.color)).toEqual(PIE_COLORS_BY_COUNT[7]);
    expect(colorOf.get('o1')).toBe(OTHERS_COLOR);
    expect(colorOf.get('o4')).toBe(OTHERS_COLOR);
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
    expect(data('chart-doughnut', 'colors')).toEqual([...PIE_COLORS_BY_COUNT[3], NO_ANSWER_COLOR]);
    expect(screen.getByRole('img', { name: /^Diagramme en secteurs/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Sans réponse' }).closest('tr')).toHaveTextContent('Sans réponse220 %');
  });

  it('« Secteurs » proposé pour une question à 8 options (« Dans quel quartier travaillez-vous ? »)', () => {
    const quartiers = ['Centre historique', 'Saint-Vincent', 'Brichebay', 'Bon Secours', "Val d'Aunette", 'Zone industrielle', 'Villevert', 'Jardiniers'];
    render(<ResultChart question={{ id: 'q5', label: 'Dans quel quartier travaillez-vous ?', type: 'CHOIX_UNIQUE', totalForQuestion: 8, options: quartiers.map((label, i) => ({ id: `o${i}`, label, count: 1, percentage: 12.5 })) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Secteurs' }));
    expect(data('chart-doughnut', 'colors')).toEqual(PIE_COLORS_BY_COUNT[8]);
  });

  it('aucune réponse : un message à la place d’un anneau vide', () => {
    render(<ResultChart question={{ ...modes, totalForQuestion: 0, options: modes.options.map((o) => ({ ...o, count: 0, percentage: 0 })) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Secteurs' }));
    expect(screen.getByText("Personne n'a encore répondu à cette question.")).toBeInTheDocument();
    expect(screen.queryByTestId('chart-doughnut')).toBeNull();
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
