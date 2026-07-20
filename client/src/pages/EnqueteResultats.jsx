// ══════════════════════════════════════════════════════════
// Page résultats — /enquetes/:slug/resultats
//
// Consomme directement GET /surveys/:slug/results (S4-03) — la
// forme de la réponse dicte l'affichage : "options" → barres,
// "stats" → nombre, "totalAnswered" → juste un compte (voir le
// contrôleur pour le détail de pourquoi le texte libre n'est pas
// exposé ici).
// ══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';

export default function EnqueteResultats() {
  const { slug } = useParams();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    api.get(`/surveys/${slug}/results`)
      .then(setResults)
      .catch((err) => setError(
        err.status === 404
          ? "Cette enquête n'existe pas ou plus."
          : (err.message || 'Impossible de charger les résultats'),
      ))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="wrap" style={{ padding: '60px 20px' }}>Chargement…</div>;
  }

  if (error || !results) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: '#6B6257' }}>{error}</p>
        <Link to="/enquetes" className="btn btn-primary" style={{ marginTop: 20 }}>
          Voir toutes les enquêtes
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 720 }}>
      <Link to={`/enquetes/${slug}`} style={{ color: '#6B6257', fontSize: 14 }}>← Retour à l'enquête</Link>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 6px' }}>
        Résultats — {results.survey.title}
      </h1>
      <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 28 }}>
        {results.totalResponses} réponse{results.totalResponses > 1 ? 's' : ''} au total
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {results.questions.map((q) => (
          <div key={q.id} className="card-joyful" style={{ padding: 20 }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 14 }}>
              {q.label}
            </h2>

            {/* CHOIX_UNIQUE / CHOIX_MULTIPLE / OUI_NON → une barre par option */}
            {q.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {q.options.map((opt) => (
                  <div key={opt.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      <span>{opt.label}</span>
                      <span style={{ color: '#6B6257' }}>{opt.count} — {opt.percentage}%</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: '#EFEBE2', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: '#1E5F7C', width: `${opt.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* NOMBRE → quelques statistiques */}
            {q.stats && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, color: '#26333A' }}>
                <span><strong>{q.stats.count}</strong> réponses</span>
                {q.stats.average !== null && (
                  <span>Moyenne : <strong>{Math.round(q.stats.average * 10) / 10}</strong></span>
                )}
                {q.stats.min !== null && <span>Min : <strong>{q.stats.min}</strong></span>}
                {q.stats.max !== null && <span>Max : <strong>{q.stats.max}</strong></span>}
              </div>
            )}

            {/* TEXTE_LIBRE → juste un compte, pas le contenu (voir contrôleur) */}
            {q.totalAnswered !== undefined && (
              <p style={{ color: '#6B6257', fontSize: 14 }}>
                {q.totalAnswered} réponse{q.totalAnswered > 1 ? 's' : ''} libre{q.totalAnswered > 1 ? 's' : ''} reçue{q.totalAnswered > 1 ? 's' : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
