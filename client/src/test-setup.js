import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createElement } from 'react';

// ── Graphiques Chart.js (S5R2-04) ────────────────────────────
// jsdom (le faux navigateur des tests) ne sait pas dessiner dans un
// <canvas>. On remplace donc les graphiques par une « doublure » : un
// simple <div> qui expose le type et les données reçues. Les tests
// vérifient ainsi CE QUI serait dessiné (bonnes valeurs, bonnes
// couleurs), sans dépendre du dessin lui-même.
// Analogie : en répétition, la doublure ne joue pas la scène, mais
// elle est à la bonne place avec le bon texte.
vi.mock('react-chartjs-2', () => {
  const stub = (type) => function ChartStub({ data }) {
    return createElement('div', {
      'data-testid': `chart-${type}`,
      'data-labels': JSON.stringify(data.labels),
      'data-values': JSON.stringify(data.datasets[0].data),
      'data-colors': JSON.stringify(data.datasets[0].backgroundColor),
    });
  };
  return { Bar: stub('bar'), Doughnut: stub('doughnut') };
});
