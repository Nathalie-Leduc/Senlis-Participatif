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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    api.get(`/surveys/${id}/stats`)
      .then(setResults)
      .catch((err) => setError(err.message || 'Impossible de charger les résultats détaillés'))
      .finally(() => setLoading(false));
  }, [id]);

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

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 800 }}>
      <Link to="/admin/enquetes" style={{ color: '#6B6257', fontSize: 14 }}>← Retour aux enquêtes</Link>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 6px' }}>
        Résultats détaillés — {results.survey.title}
      </h1>
      <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 20 }}>
        {results.totalResponses} réponse{results.totalResponses > 1 ? 's' : ''} au total
        {' · '}audience ciblée : {results.audience === 'TOUS' ? 'tous les habitants' : results.audience.toLowerCase()}
      </p>

      {/* ── Écart audience ciblée / situation déclarée ─────── */}
      <div className="card-joyful" style={{ padding: 20, marginBottom: 24, background: '#E3EEF3' }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 10, color: '#1E5F7C' }}>
          Qui a vraiment répondu ?
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(results.situationBreakdown).map(([key, count]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>{SITUATION_SHORT_LABELS[key] || key}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#6B6257', marginTop: 10 }}>
          Situation auto-déclarée par chaque citoyen (jamais vérifiée) — à recouper avec l'audience ciblée ci-dessus.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {results.questions.map((q) => (
          <div key={q.id} className="card-joyful" style={{ padding: 20 }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 4 }}>
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
    </div>
  );
}
