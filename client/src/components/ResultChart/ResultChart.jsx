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
//    - recette du 14/10 : sur TOUTES ces questions, quel que soit le
//      nombre d'options (« Dans quel quartier ? » en a 7 ou 8). Au-delà
//      de 8 parts, les plus petites sont regroupées en « Autres
//      réponses » ; le tableau garde chaque option.
//    Les personnes qui ont vu la question sans y répondre forment une
//    part grise « Sans réponse » : le tout, c'est bien 100 % des
//    personnes concernées, comme dans le tableau.
//
// 3. Les couleurs : barres d'une seule teinte (Bleu Nonette) ; secteurs
//    en 8 couleurs proches de la charte, plus franches, dans un ordre
//    calculé pour chaque nombre de parts, vérifié pour les daltonismes
//    (voir utils/resultChartRules.js).
// ══════════════════════════════════════════════════════════

import { useEffect, useId, useRef, useState } from 'react';
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  canShowPie, pieSlices, wrapLabel,
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
function describe(question, pie) {
  if (pie) {
    // Les parts réellement dessinées (regroupement et « Sans réponse » compris)
    const total = question.totalForQuestion || 1;
    const parts = pie.slices.map((slice) => `${slice.label} ${pct(Math.round((slice.count / total) * 1000) / 10)} %`);
    return `Diagramme en secteurs : ${parts.join(', ')}. Détail dans le tableau qui suit.`;
  }
  const parts = question.options.map((o) => `${o.label} ${pct(o.percentage)} %`);
  return `Diagramme en barres : ${parts.join(', ')}. Détail dans le tableau qui suit.`;
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
  // Les parts (couleur de chaque option, regroupement, « Sans réponse »)
  const pie = showPie ? pieSlices(question) : null;

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

      {/* Personne n'a (encore) répondu : un anneau vide ne dirait rien */}
      {pie && pie.slices.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
          Personne n&apos;a encore répondu à cette question.
        </p>
      ) : (
      /* Le dessin : décrit en une phrase, le détail est dans le tableau */
      <div
        role="img"
        aria-label={describe(question, pie)}
        aria-describedby={tableId}
        style={{ position: 'relative', height: showPie ? 240 : Math.max(90, options.length * (labelWidth() < 20 ? 52 : 44) + 30), maxWidth: showPie ? 320 : '100%', margin: showPie ? '0 auto' : 0 }}
      >
        {showPie
          ? <Doughnut ref={chartRef} data={pieData(pie)} options={pieOptions(question)} />
          : <Bar ref={chartRef} data={barData(question)} options={barOptions(question)} />}
      </div>
      )}

      <ResultTable id={tableId} question={question} pie={pie} />
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
function pieData(pie) {
  return {
    labels: pie.slices.map((slice) => slice.label),
    datasets: [{
      data: pie.slices.map((slice) => slice.count),
      backgroundColor: pie.slices.map((slice) => slice.color),
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
function ResultTable({ id, question, pie }) {
  // Lignes ajoutées par l'anneau : « Autres réponses » n'a pas de ligne
  // (ses options ont chacune la leur, avec la pastille foncée) ; « Sans
  // réponse », si.
  const noAnswer = pie?.slices.find((slice) => slice.label === 'Sans réponse');
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
        {question.options.map((o) => (
          <tr key={o.id ?? o.label}>
            <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 500 }}>
              {/* Une option choisie par personne n'a pas de part : place vide,
                  pour que les intitulés restent alignés */}
              {pie && <Swatch color={pie.colorOf.get(o.id ?? o.label)} />}
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
        {noAnswer && (
          <tr>
            <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 500, color: MUTED }}>
              <Swatch color={noAnswer.color} />Sans réponse
            </th>
            <td style={{ ...num, color: MUTED }}>{noAnswer.count}</td>
            <td style={{ ...num, color: MUTED }}>{total ? pct(Math.round((noAnswer.count / total) * 1000) / 10) : 0} %</td>
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
      style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: color ?? 'transparent', marginRight: 8, verticalAlign: '-1px' }}
    />
  );
}
