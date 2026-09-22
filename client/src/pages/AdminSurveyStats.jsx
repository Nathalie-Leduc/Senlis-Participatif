import { useState, useEffect, useMemo } from 'react';
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

  // Retrouve, pour une question BRANCHÉE, la question et l'option qui
  // déclenchent son affichage — indispensable ici : plusieurs
  // questions de cette enquête partagent EXACTEMENT le même libellé
  // ("Lesquelles ?", "Où sont garés vos véhicules ?"...) sans ce
  // repère, impossible de savoir laquelle est laquelle dans la liste.
  const triggerLookup = useMemo(() => {
    if (!results) return new Map();
    const map = new Map();
    for (const q of results.questions) {
      for (const opt of q.options || []) {
        map.set(opt.id, { questionLabel: q.label, optionLabel: opt.label });
      }
    }
    return map;
  }, [results]);

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
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 900 }}>
      <div className="no-print">
        <Link to="/admin/enquetes" style={{ color: '#6B6257', fontSize: 14 }}>← Retour aux enquêtes</Link>
      </div>

      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, margin: '12px 0 6px' }}>
        <div>
          <label htmlFor="segment-select" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6B6257', marginBottom: 4 }}>
            Comparer par...
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

      {results.situationBreakdown && (
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
      )}

      {/* ── Une seule liste, dans l'ordre du questionnaire — chaque
          question apparaît UNE FOIS, avec la comparaison par segment
          intégrée à même sa propre carte plutôt que dans un rapport
          séparé par segment. ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {results.questions.map((question) => {
          const trigger = question.showIfOptionId ? triggerLookup.get(question.showIfOptionId) : null;
          const segmentsForThisQuestion = results.segmentedBy?.segments.map((segment) => ({
            optionLabel: segment.optionLabel,
            question: segment.questions.find((q) => q.id === question.id),
          }));

          return (
            <div key={question.id} className="card-joyful" style={{ padding: 20 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 4 }}>
                {question.label}
              </h2>
              {trigger && (
                <p style={{ fontSize: 13, color: '#1E5F7C', marginBottom: 10 }}>
                  Affichée si « {trigger.questionLabel} » = « {trigger.optionLabel} »
                  {' · '}posée à {question.totalForQuestion} répondant{question.totalForQuestion > 1 ? 's' : ''} concerné{question.totalForQuestion > 1 ? 's' : ''}
                </p>
              )}

              {!results.segmentedBy && <QuestionBody question={question} />}

              {results.segmentedBy && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 12, color: '#6B6257', marginBottom: 8, fontWeight: 600 }}>
                    Résultat global :
                  </p>
                  <QuestionBody question={question} />

                  <p style={{ fontSize: 12, color: '#6B6257', margin: '16px 0 8px', fontWeight: 600 }}>
                    Par « {results.segmentedBy.questionLabel} » :
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {segmentsForThisQuestion.map(({ optionLabel, question: segQuestion }) => (
                      <div key={optionLabel} style={{ paddingLeft: 12, borderLeft: '3px solid #E3EEF3' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1E5F7C', marginBottom: 4 }}>
                          {optionLabel}
                          {segQuestion ? ` (${segQuestion.totalForQuestion} concerné${segQuestion.totalForQuestion > 1 ? 's' : ''})` : ''}
                        </p>
                        {segQuestion && segQuestion.totalForQuestion > 0
                          ? <QuestionBody question={segQuestion} compact />
                          : <p style={{ fontSize: 13, color: '#6B6257' }}>Personne dans ce segment.</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, header { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// Le contenu d'UNE question (options, statistiques, ou texte libre) —
// rejoué à l'identique pour le résultat global et pour chaque
// segment, sans jamais dupliquer le titre de la question lui-même
// (déjà affiché une seule fois par le composant parent).
function QuestionBody({ question: q, compact = false }) {
  return (
    <>
      {q.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 8 }}>
          {q.options.map((opt) => (
            <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: compact ? 13 : 14 }}>
              <span>{opt.label}</span>
              <span style={{ color: '#6B6257' }}>{opt.count} — {opt.percentage}%</span>
            </div>
          ))}
        </div>
      )}

      {q.stats && (
        <div style={{ display: 'flex', gap: compact ? 12 : 18, flexWrap: 'wrap', fontSize: compact ? 13 : 14 }}>
          <span><strong>{q.stats.count}</strong> réponses</span>
          {q.stats.average !== null && <span>Moyenne : <strong>{Math.round(q.stats.average * 10) / 10}</strong></span>}
          {q.stats.min !== null && <span>Min : <strong>{q.stats.min}</strong></span>}
          {q.stats.max !== null && <span>Max : <strong>{q.stats.max}</strong></span>}
        </div>
      )}

      {/* TEXTE_LIBRE : contenu brut affiché — c'est justement le
          point de cette vue admin (jamais sur la vue publique). */}
      {q.answers !== undefined && (
        <div>
          <p style={{ fontSize: compact ? 12 : 13, color: '#6B6257', marginBottom: 6 }}>
            {q.totalAnswered} réponse{q.totalAnswered > 1 ? 's' : ''} libre{q.totalAnswered > 1 ? 's' : ''}
          </p>
          {q.answers.length > 0 && (
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {q.answers.map((text, i) => (
                <li key={i} style={{ fontSize: compact ? 13 : 14, color: '#26333A' }}>{text}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
