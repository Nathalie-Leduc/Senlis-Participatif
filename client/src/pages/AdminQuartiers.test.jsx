// ══════════════════════════════════════════════════════════
// Tests — outil de tracé de Saint-Vincent (S5R2-06)
// La vraie carte Leaflet est remplacée par un faux : on « clique »
// en appelant directement onAddPoint, comme le ferait la carte.
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const iris = JSON.parse(readFileSync(path.join(process.cwd(), 'public/data/iris-senlis.geojson'), 'utf8'));
vi.mock('../utils/irisData.js', () => ({ loadIris: () => Promise.resolve(iris) }));
vi.mock('../utils/download.js', () => ({ downloadText: vi.fn() }));
let mapProps;
vi.mock('../components/QuartierDrawMap/QuartierDrawMap.jsx', () => ({
  default: (props) => { mapProps = props; return <div data-testid="draw-map" />; },
}));

const { downloadText } = await import('../utils/download.js');
const { default: AdminQuartiers, adjustBounds, boundsOf } = await import('./AdminQuartiers.jsx');

const EAST_HALF = [[49.215, 2.590], [49.215, 2.620], [49.195, 2.620], [49.195, 2.590]];

async function renderPage() {
  render(<MemoryRouter><AdminQuartiers /></MemoryRouter>);
  await screen.findByTestId('draw-map');
}

beforeEach(() => { vi.clearAllMocks(); });

describe('Outil de tracé — parcours complet', () => {
  it('tracer, calculer, vérifier, télécharger un fichier de 8 quartiers', async () => {
    await renderPage();
    const computeButton = screen.getByRole('button', { name: 'Calculer le découpage' });
    expect(computeButton).toBeDisabled(); // pas encore 3 points

    act(() => EAST_HALF.forEach((p) => mapProps.onAddPoint(p)));
    expect(screen.getByText('4 points')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Télécharger le fichier des quartiers' })).toBeDisabled();

    fireEvent.click(computeButton);
    expect(screen.getByText(/Saint-Vincent représente \d+ % de l'ancien « Centre Ville »/)).toBeInTheDocument();
    expect(screen.getByText(/de votre tracé est hors du centre de l'INSEE/)).toBeInTheDocument();
    expect(mapProps.preview.saintVincent.properties.quartier).toBe('SAINT_VINCENT');

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier des quartiers' }));
    const [content, filename] = downloadText.mock.calls[0];
    expect(filename).toBe('iris-senlis.geojson');
    expect(JSON.parse(content).features).toHaveLength(8);
  });

  it('modifier le tracé efface le résultat (il ne correspondrait plus)', async () => {
    await renderPage();
    act(() => EAST_HALF.forEach((p) => mapProps.onAddPoint(p)));
    fireEvent.click(screen.getByRole('button', { name: 'Calculer le découpage' }));
    expect(mapProps.preview).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler le dernier point' }));
    expect(screen.getByText('3 points')).toBeInTheDocument();
    expect(mapProps.preview).toBeFalsy();
  });

  it('un tracé loin du centre : message d’erreur clair, rien à télécharger', async () => {
    await renderPage();
    act(() => [[49.25, 2.55], [49.25, 2.56], [49.24, 2.56]].forEach((p) => mapProps.onAddPoint(p)));
    fireEvent.click(screen.getByRole('button', { name: 'Calculer le découpage' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/ne touche pas le centre/);
    expect(screen.getByRole('button', { name: 'Télécharger le fichier des quartiers' })).toBeDisabled();
  });

  it('le plan en surimpression : réglages visibles une fois l’image choisie', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:plan');
    URL.revokeObjectURL = vi.fn();
    await renderPage();
    expect(screen.queryByRole('group', { name: 'Caler le plan sur la carte' })).toBeNull();

    const file = new File(['png'], 'plan.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Image du plan/), { target: { files: [file] } });
    expect(mapProps.overlay).toMatchObject({ url: 'blob:plan', opacity: 0.5 });

    const before = mapProps.overlay.bounds;
    fireEvent.click(screen.getByRole('button', { name: '↑ Monter' }));
    expect(mapProps.overlay.bounds[0][0]).toBeGreaterThan(before[0][0]);

    fireEvent.click(screen.getByRole('button', { name: 'Retirer le plan' }));
    expect(mapProps.overlay).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:plan'); // mémoire libérée
  });
});

describe('Réglages du plan (fonctions pures)', () => {
  const b = [[49, 2], [50, 3]];
  it('déplacer garde la taille ; agrandir garde le centre', () => {
    const up = adjustBounds(b, 'up');
    expect(up[1][0] - up[0][0]).toBeCloseTo(1);
    const big = adjustBounds(b, 'bigger');
    expect((big[0][0] + big[1][0]) / 2).toBeCloseTo(49.5);
    expect(big[1][1] - big[0][1]).toBeGreaterThan(1);
  });
  it('boundsOf : l’emprise de tous les contours', () => {
    const [[south, west], [north, east]] = boundsOf(iris);
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(east);
    expect(boundsOf({ features: [] })).toBeNull();
  });
});
