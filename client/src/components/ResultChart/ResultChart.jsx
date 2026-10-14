// ══════════════════════════════════════════════════════════
// Graphique des résultats d'une question à choix (S5R2-04)
//
// Chart.js (via react-chartjs-2), en BARRES par défaut, avec un choix
// « Secteurs » quand il a un sens. Utilisé par la page publique des
// résultats ET la page des résultats détaillés de l'administration.
//
// Trois règles :
//
// 1. Les NOMBRES restent en texte, à côté, dans un vrai tableau.
//    Un graphique Chart.js est un dessin (<canvas>) : un lecteur d'écran
//    n'y lit rien. Le canvas reçoit une description courte (role="img"),
//    et le tableau donne tout le détail (RGAA 1.1 et 3.1 : l'information
//    ne repose jamais sur la seule forme ou couleur).
//    Analogie : la carte d'un restaurant avec photos — la photo donne
//    envie, mais le prix est écrit à côté.
//
// 2. Les SECTEURS ne sont proposés que quand ils sont justes :
//    - une seule réponse possible (Oui/Non, Choix unique) : les parts
//      forment un tout (avec des choix multiples, la somme dépasse 100 %,
//      et un « camembert » mentirait) ;
//    - de 3 à 5 options : à 2 parts, les barres se lisent mieux ; au-delà
//      de 5, les secteurs deviennent trop fins pour être comparés ;
//    - aucune option conditionnelle (proposée à une partie seulement :
//      les parts ne porteraient pas sur les mêmes personnes).
//    Les personnes qui ont vu la question sans y répondre forment une
//    part grise « Sans réponse » : le tout, c'est bien 100 % des
//    personnes concernées, comme dans le tableau.
//
// 3. Les couleurs : barres d'une seule teinte (Bleu Nonette) ; secteurs
//    en 5 couleurs proches de la charte, plus franches, dans un ordre
//    FIXE vérifié pour les daltonismes (outil de validation de palette,
//    voisins deux à deux, y compris le dernier secteur avec le premier).
// ══════════════════════════════════════════════════════════

import { useEffect, useId, useRef, useState } from 'react';
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  SLICE_COLORS, NO_ANSWER_COLOR, canShowPie, noAnswerCount, wrapLabel,
} from '../../utils/resultChartRules.js';

// Chart.js est découpé en morceaux : on n'enregistre que ceux qui
// servent (barres, secteurs, axes, infobulle) — le reste n'est pas
// embarqué. Ce fichier n'est importé que par les pages de résultats,
// elles-mêmes chargées à la demande (React.lazy) : aucun poids ajouté
// au reste du site.
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip);

const BAR_COLOR = '#1E5F7C'; // Bleu Nonette (charte)
const INK = '#26333A'; // Ardoise
const MUTED = '#6B6257'; // Gris pierre
const GRID = '#EFEBE2';

/** « 12,5 » — pourcentage à la française */
const pct = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Description courte du graphique, pour les lecteurs d'écran */
function describe(question, kind) {
  const parts = question.options.map((o) => `${o.label} ${pct(o.percentage)} %`);
  const shape = kind === 'pie' ? 'Diagramme en secteurs' : 'Diagramme en barres';
  return `${shape} : ${parts.join(', ')}. Détail dans le tableau qui suit.`;
}

/**
 * Largeur des lignes d'intitulé : sur un téléphone, l'axe des intitulés
 * n'a qu'environ 150 px — au-delà de ~16 caractères, Chart.js coupe le
 * texte (« …arches administratives » constaté le 14/10).
 */
const labelWidth = () => (typeof window !== 'undefined'
  && window.matchMedia?.('(max-width: 600px)').matches ? 16 : 28);

/** Animation coupée si la personne a demandé moins de mouvement */
const prefersReducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function ResultChart({ question }) {
  const pieAllowed = canShowPie(question);
  const [kind, setKind] = useState('bar');
  const tableId = useId();
  const chartRef = useRef(null);
  const options = question.options ?? [];

  // Impression / export PDF : la page change de largeur, Chart.js doit
  // redessiner le canvas à la nouvelle taille, sinon il est coupé.
  useEffect(() => {
    const resize = () => chartRef.current?.resize();
    window.addEventListener('beforeprint', resize);
    return () => window.removeEventListener('beforeprint', resize);
  }, []);

  if (options.length === 0) return null;
  const showPie = pieAllowed && kind === 'pie';
  const noAnswer = showPie ? noAnswerCount(question) : 0;

  return (
    <div className="result-chart">
      {pieAllowed && (
        <div role="group" aria-label="Type de graphique" className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[['bar', 'Barres'], ['pie', 'Secteurs']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              style={{
                padding: '4px 12px', minHeight: 32, borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `2px solid ${kind === value ? BAR_COLOR : '#e3dcce'}`,
                background: kind === value ? BAR_COLOR : '#fff',
                color: kind === value ? '#fff' : INK,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Le dessin : décrit en une phrase, le détail est dans le tableau */}
      <div
        role="img"
        aria-label={describe(question, showPie ? 'pie' : 'bar')}
        aria-describedby={tableId}
        style={{ position: 'relative', height: showPie ? 240 : Math.max(90, options.length * (labelWidth() < 20 ? 52 : 44) + 30), maxWidth: showPie ? 320 : '100%', margin: showPie ? '0 auto' : 0 }}
      >
        {showPie
          ? <Doughnut ref={chartRef} data={pieData(question, noAnswer)} options={pieOptions(question)} />
          : <Bar ref={chartRef} data={barData(question)} options={barOptions(question)} />}
      </div>

      <ResultTable id={tableId} question={question} withSwatches={showPie} noAnswer={noAnswer} />
    </div>
  );
}

// ── Barres horizontales : une seule teinte, % des personnes concernées ──
function barData(question) {
  return {
    labels: question.options.map((o) => wrapLabel(o.label, labelWidth())),
    datasets: [{
      data: question.options.map((o) => o.percentage),
      backgroundColor: BAR_COLOR,
      borderRadius: 4, // extrémité arrondie côté valeur
      borderSkipped: 'start', // … et droite côté axe
      barThickness: 18,
      maxBarThickness: 18,
    }],
  };
}

function barOptions(question) {
  return {
    indexAxis: 'y', // barres horizontales : les intitulés longs restent lisibles
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : { duration: 600 },
    scales: {
      x: {
        min: 0,
        max: 100,
        grid: { color: GRID },
        border: { display: false },
        ticks: { color: MUTED, callback: (v) => `${v} %` },
      },
      y: {
        grid: { display: false },
        ticks: { color: INK, font: { size: 13 } },
      },
    },
    plugins: {
      legend: { display: false }, // une seule série : le titre de la question suffit
      tooltip: {
        callbacks: {
          title: (items) => question.options[items[0].dataIndex].label,
          label: (item) => {
            const o = question.options[item.dataIndex];
            return `${plural(o.count, 'réponse')} — ${pct(o.percentage)} %`;
          },
        },
      },
    },
  };
}

// ── Secteurs (anneau) : les parts des personnes concernées ───────
function pieData(question, noAnswer) {
  const labels = question.options.map((o) => o.label);
  const counts = question.options.map((o) => o.count);
  const colors = SLICE_COLORS.slice(0, question.options.length);
  if (noAnswer > 0) {
    labels.push('Sans réponse');
    counts.push(noAnswer);
    colors.push(NO_ANSWER_COLOR);
  }
  return {
    labels,
    datasets: [{
      data: counts,
      backgroundColor: colors,
      borderColor: '#fff', // 2 px de blanc entre deux parts : elles se distinguent même sans la couleur
      borderWidth: 2,
    }],
  };
}

function pieOptions(question) {
  const total = question.totalForQuestion || 1;
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '55%',
    animation: prefersReducedMotion() ? false : { duration: 600 },
    plugins: {
      legend: { display: false }, // la légende, c'est le tableau (pastilles de couleur)
      tooltip: {
        callbacks: {
          label: (item) => `${item.label} : ${plural(item.raw, 'personne')} — ${pct((item.raw / total) * 100)} %`,
        },
      },
    },
  };
}

// ── Le tableau des nombres (toujours affiché) ───────────────────
function ResultTable({ id, question, withSwatches, noAnswer }) {
  const cell = { padding: '6px 8px', borderBottom: `1px solid ${GRID}`, fontSize: 14, verticalAlign: 'top' };
  const num = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' };
  const total = question.totalForQuestion || 0;
  return (
    <table id={id} style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
      <caption className="sr-only">Résultats de « {question.label} »</caption>
      <thead>
        <tr>
          <th scope="col" style={{ ...cell, textAlign: 'left', color: MUTED, fontSize: 13, fontWeight: 600 }}>Réponse</th>
          <th scope="col" style={{ ...num, color: MUTED, fontSize: 13, fontWeight: 600 }}>Nombre</th>
          <th scope="col" style={{ ...num, color: MUTED, fontSize: 13, fontWeight: 600 }}>Part</th>
        </tr>
      </thead>
      <tbody>
        {question.options.map((o, i) => (
          <tr key={o.id ?? o.label}>
            <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 500 }}>
              {withSwatches && <Swatch color={SLICE_COLORS[i]} />}
              {o.label}
              {/* S5R2-02 : option proposée à une partie des personnes seulement */}
              {typeof o.offeredTo === 'number' && (
                <span style={{ color: MUTED, fontSize: 13 }}> · proposée à {plural(o.offeredTo, 'personne')}</span>
              )}
            </th>
            <td style={{ ...num, fontWeight: 600 }}>{o.count}</td>
            <td style={{ ...num, color: MUTED }}>{pct(o.percentage)} %</td>
          </tr>
        ))}
        {withSwatches && noAnswer > 0 && (
          <tr>
            <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 500, color: MUTED }}>
              <Swatch color={NO_ANSWER_COLOR} />Sans réponse
            </th>
            <td style={{ ...num, color: MUTED }}>{noAnswer}</td>
            <td style={{ ...num, color: MUTED }}>{total ? pct(Math.round((noAnswer / total) * 1000) / 10) : 0} %</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Pastille de couleur : relie la ligne du tableau à sa part (décorative) */
function Swatch({ color }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: color, marginRight: 8, verticalAlign: '-1px' }}
    />
  );
}
