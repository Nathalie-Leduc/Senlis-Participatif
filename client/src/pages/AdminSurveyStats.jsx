// ══════════════════════════════════════════════════════════
// Page Admin — résultats détaillés d'une enquête
// /admin/enquetes/:id/stats
//
// Distincte de EnqueteResultats.jsx (la vue publique) : consomme
// GET /surveys/:id/stats plutôt que /surveys/:slug/results — jamais
// soumise au garde-fou resultsPublished (l'admin voit toujours),
// contenu brut des réponses texte libre inclus, et écart entre
// l'audience ciblée et la situation réellement déclarée des
// répondants (revue du cahier des charges — savoir si ce sont
// vraiment les résidents/commerçants du centre qui répondent).
// ══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { SITUATION_SHORT_LABELS } from '../constants/situation.js';

export default function AdminSurveyStats() {
  const { id } = useParams();
  const [results, setResults] = useState(null);
  const [segmentBy, setSegmentBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const query = segmentBy ? `?segmentBy=${encodeURIComponent(segmentBy)}` : '';
    api.get(`/surveys/${id}/stats${query}`)
      .then(setResults)
      .catch((err) => setError(err.message || 'Impossible de charger les résultats détaillés'))
      .finally(() => setLoading(false));
  }, [id, segmentBy]);

  if (loading) {
    return <div className="wrap" style={{ padding: '60px 20px' }}>Chargement…</div>;
  }

  if (error || !results) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: '#6B6257' }}>{error}</p>
        <Link to="/admin/enquetes" className="btn btn-primary" style={{ marginTop: 20 }}>
          Retour aux enquêtes
        </Link>
      </div>
    );
  }

  // Seule une question à réponse UNIQUE peut segmenter (voir le
  // commentaire côté contrôleur : CHOIX_MULTIPLE romprait
  // l'addition segments = total, un même répondant pouvant
  // appartenir à plusieurs cases à la fois).
  const segmentableQuestions = results.questions.filter((q) => ['CHOIX_UNIQUE', 'OUI_NON'].includes(q.type));

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 800 }}>
      {/* Masqué à l'impression — n'a de sens qu'à l'écran, dans le
          site (voir le bloc <style> plus bas pour @media print). */}
      <div className="no-print">
        <Link to="/admin/enquetes" style={{ color: '#6B6257', fontSize: 14 }}>← Retour aux enquêtes</Link>
      </div>

      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, margin: '12px 0 6px' }}>
        <div>
          <label htmlFor="segment-select" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6B6257', marginBottom: 4 }}>
            Segmenter par...
          </label>
          <select
            id="segment-select"
            value={segmentBy}
            onChange={(e) => setSegmentBy(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #e3dcce', fontSize: 14, minWidth: 220 }}
            disabled={segmentableQuestions.length === 0}
          >
            <option value="">Aucune (résultats globaux)</option>
            {segmentableQuestions.map((q) => (
              <option key={q.id} value={q.id}>{q.label}</option>
            ))}
          </select>
        </div>
        <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: '10px 20px' }}>
          Imprimer / Exporter en PDF
        </button>
      </div>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 6px' }}>
        Résultats détaillés — {results.survey.title}
      </h1>
      <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 20 }}>
        {results.totalResponses} réponse{results.totalResponses > 1 ? 's' : ''} au total
        {' · '}audience ciblée : {results.audience === 'TOUS' ? 'tous les habitants' : results.audience.toLowerCase()}
      </p>

      <ResultsBlock results={results} />

      {/* ── Segments — un bloc complet par option de la question
          choisie ci-dessus, chacun avec son propre total, sa propre
          répartition par situation, et ses propres questions. ── */}
      {results.segmentedBy && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 4 }}>
            Par « {results.segmentedBy.questionLabel} »
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 16 }}>
            {results.segmentedBy.segments.map((segment) => (
              <div key={segment.optionId}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 8, color: '#1E5F7C' }}>
                  {segment.optionLabel} — {segment.totalResponses} répondant{segment.totalResponses > 1 ? 's' : ''}
                </h3>
                {segment.totalResponses > 0
                  ? <ResultsBlock results={segment} compact />
                  : <p style={{ color: '#6B6257', fontSize: 14 }}>Personne dans ce segment pour l'instant.</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Masqué à l'écran ET jamais servi par un fichier séparé — le
          plus simple pour un usage aussi ponctuel qu'une feuille de
          style d'impression. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, header { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// Factorisé pour être rejoué à l'identique pour le total général ET
// pour chaque segment — évite de dupliquer tout le JSX d'affichage
// des questions (options, statistiques, texte libre).
function ResultsBlock({ results, compact = false }) {
  return (
    <>
      {/* ── Écart audience ciblée / situation déclarée ─────── */}
      {results.situationBreakdown && (
        <div className="card-joyful" style={{ padding: compact ? 14 : 20, marginBottom: compact ? 14 : 24, background: '#E3EEF3' }}>
          {!compact && (
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 10, color: '#1E5F7C' }}>
              Qui a vraiment répondu ?
            </h2>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(results.situationBreakdown).map(([key, count]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>{SITUATION_SHORT_LABELS[key] || key}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          {!compact && (
            <p style={{ fontSize: 12, color: '#6B6257', marginTop: 10 }}>
              Situation auto-déclarée par chaque citoyen (jamais vérifiée) — à recouper avec l'audience ciblée ci-dessus.
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 12 : 20 }}>
        {results.questions.map((q) => (
          <div key={q.id} className="card-joyful" style={{ padding: compact ? 14 : 20 }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: compact ? 15 : 18, marginBottom: 4 }}>
              {q.label}
            </h2>
            {q.totalForQuestion !== results.totalResponses && (
              <p style={{ color: '#6B6257', fontSize: 13, marginBottom: 10 }}>
                Question branchée — posée à {q.totalForQuestion} répondant{q.totalForQuestion > 1 ? 's' : ''} concerné{q.totalForQuestion > 1 ? 's' : ''}
              </p>
            )}

            {q.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {q.options.map((opt) => (
                  <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span>{opt.label}</span>
                    <span style={{ color: '#6B6257' }}>{opt.count} — {opt.percentage}%</span>
                  </div>
                ))}
              </div>
            )}

            {q.stats && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, marginTop: 10 }}>
                <span><strong>{q.stats.count}</strong> réponses</span>
                {q.stats.average !== null && <span>Moyenne : <strong>{Math.round(q.stats.average * 10) / 10}</strong></span>}
                {q.stats.min !== null && <span>Min : <strong>{q.stats.min}</strong></span>}
                {q.stats.max !== null && <span>Max : <strong>{q.stats.max}</strong></span>}
              </div>
            )}

            {/* TEXTE_LIBRE : ici, contrairement à la vue publique, le
                contenu brut est affiché — c'est justement le point de
                cette vue admin. Pseudonymisé comme partout ailleurs sur
                le site (jamais l'email, jamais l'identité réelle). */}
            {q.answers && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 13, color: '#6B6257', marginBottom: 8 }}>
                  {q.totalAnswered} réponse{q.totalAnswered > 1 ? 's' : ''} libre{q.totalAnswered > 1 ? 's' : ''}
                </p>
                {q.answers.length > 0 && (
                  <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.answers.map((text, i) => (
                      <li key={i} style={{ fontSize: 14, color: '#26333A' }}>{text}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
