// ══════════════════════════════════════════════════════════
// Résultats détaillés d'une proposition (admin) — S5-21
//
// Pendant de AdminSurveyStats.jsx pour les VOTES : totaux, puis
// (au choix) répartition selon UN champ du profil des votants,
// imprimable / exportable en PDF pour le dossier à remettre à la
// mairie.
//
// Règle de confidentialité (appliquée par l'API, jamais ici) : un
// groupe de 1 à 4 votants arrive déjà masqué (masked: true, sans
// chiffres) — cette page se contente de l'expliquer. Le client ne
// reçoit donc jamais les données sensibles, même en inspectant le
// réseau. Analogie : on ne confie pas au facteur une lettre qu'il
// ne doit pas lire en lui demandant de ne pas l'ouvrir — on ne la
// lui donne pas.
// ══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { PROFILE_DIMENSIONS } from '../constants/situation.js';
import { votePercentages, segmentLabel } from '../utils/voteStats.js';

export default function AdminPropositionStats() {
  const { id } = useParams();
  const [stats, setStats] = useState(null);
  const [segmentBy, setSegmentBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recharge à chaque changement d'axe : c'est l'API qui calcule
  // (et masque) les segments, pas le navigateur.
  useEffect(() => {
    setLoading(true);
    setError(null);
    const query = segmentBy ? `?segmentBy=${encodeURIComponent(segmentBy)}` : '';
    api.get(`/proposals/${id}/stats${query}`)
      .then(setStats)
      .catch((err) => setError(err.message || 'Impossible de charger les résultats'))
      .finally(() => setLoading(false));
  }, [id, segmentBy]);

  if (loading && !stats) {
    return <div className="wrap" style={{ padding: '60px 20px' }}>Chargement…</div>;
  }

  if (error || !stats) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p role="alert" style={{ color: '#6B6257' }}>{error}</p>
        <Link to="/admin/propositions" className="btn btn-primary" style={{ marginTop: 20 }}>
          Retour aux propositions
        </Link>
      </div>
    );
  }

  const dimension = PROFILE_DIMENSIONS.find((d) => d.value === stats.segmentedBy?.dimension);

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 900 }}>
      {/* Titre de l'onglet (RGAA 8.6) — React 19 place ce <title> dans le <head> */}
      <title>{`Résultats — ${stats.proposal.title} — Senlis Participatif`}</title>

      <div className="no-print">
        <Link to="/admin/propositions" style={{ color: '#6B6257', fontSize: 14 }}>← Retour aux propositions</Link>
      </div>

      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, margin: '12px 0 6px' }}>
        <div>
          <label htmlFor="vote-segment-select" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6B6257', marginBottom: 4 }}>
            Répartir les votes selon…
          </label>
          <select
            id="vote-segment-select"
            value={segmentBy}
            onChange={(e) => setSegmentBy(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #e3dcce', fontSize: 14, minWidth: 260 }}
          >
            <option value="">Aucun critère (totaux seuls)</option>
            {PROFILE_DIMENSIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: '10px 20px' }}>
          Imprimer / Exporter en PDF
        </button>
      </div>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 6px' }}>
        Résultats détaillés — {stats.proposal.title}
      </h1>
      <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 20 }}>
        {stats.totalVotes} vote{stats.totalVotes > 1 ? 's' : ''} au total
        {' · '}édité le {new Date().toLocaleDateString('fr-FR')}
      </p>

      {/* aria-live : quand l'admin change de critère, un lecteur
          d'écran annonce que les chiffres ont été mis à jour. */}
      <div aria-live="polite" aria-busy={loading}>
        <section className="card-joyful" style={{ padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 12 }}>Ensemble des votants</h2>
          <VoteBreakdown votes={stats.votes} />
        </section>

        {stats.segmentedBy && (
          <section className="card-joyful" style={{ padding: 20 }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 4 }}>
              Par « {dimension?.label || stats.segmentedBy.dimension} »
            </h2>
            <p style={{ fontSize: 13, color: '#6B6257', marginBottom: 16 }}>
              Profil auto-déclaré par chaque citoyen (jamais vérifié). Pour protéger l'anonymat
              des votes, un groupe de moins de {stats.segmentedBy.minGroupSize} votants n'est
              jamais détaillé.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stats.segmentedBy.segments.map((segment) => (
                <div key={String(segment.value)} style={{ paddingLeft: 12, borderLeft: '3px solid #E3EEF3' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1E5F7C', marginBottom: 6 }}>
                    {segmentLabel(stats.segmentedBy.dimension, segment.value)}
                    {!segment.masked && ` (${segment.totalVotes} votant${segment.totalVotes > 1 ? 's' : ''})`}
                  </h3>
                  {segment.masked ? (
                    <p style={{ fontSize: 13, color: '#6B6257' }}>
                      Moins de {stats.segmentedBy.minGroupSize} votants — détail masqué.
                    </p>
                  ) : segment.totalVotes === 0 ? (
                    <p style={{ fontSize: 13, color: '#6B6257' }}>Aucun votant dans ce groupe.</p>
                  ) : (
                    <VoteBreakdown votes={segment.votes} compact />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, header, footer { display: none !important; }
          .card-joyful { box-shadow: none !important; border: 1px solid #ccc; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

// Les trois camps, en texte + barre. Le texte porte TOUTE
// l'information (✓ ◯ ✗ + nombres) : la barre colorée n'est qu'un
// repère visuel — la couleur ne porte jamais seule le sens (charte,
// §2), ce qui compte aussi une fois imprimé en noir et blanc.
function VoteBreakdown({ votes, compact = false }) {
  const pct = votePercentages(votes);
  const rows = [
    { key: 'POUR', symbol: '✓', label: 'Pour', color: '#3A7A4D' },
    { key: 'NEUTRE', symbol: '◯', label: 'Neutre', color: '#6B6257' },
    { key: 'CONTRE', symbol: '✗', label: 'Contre', color: '#A8442F' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 8 }}>
      {rows.map((row) => (
        <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px', alignItems: 'center', gap: 10, fontSize: compact ? 13 : 14 }}>
          <span style={{ color: row.color, fontWeight: 700 }}>
            <span aria-hidden="true">{row.symbol} </span>{row.label}
          </span>
          <span aria-hidden="true" style={{ height: 10, background: '#EFEBE2', borderRadius: 999, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${pct[row.key]}%`, background: row.color }} />
          </span>
          <span style={{ textAlign: 'right', color: '#26333A' }}>
            {votes[row.key]} — {pct[row.key]} %
          </span>
        </div>
      ))}
    </div>
  );
}
