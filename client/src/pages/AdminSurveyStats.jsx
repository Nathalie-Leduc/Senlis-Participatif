// ══════════════════════════════════════════════════════════
// Résultats détaillés d'une enquête — vue admin (S5R-08)
//
// Recette du 30/09 : « les résultats sont ingérables, illisibles, trop
// complexes — le sélecteur ne change rien, on voit toutes les questions-
// réponses. Il faudrait sélectionner les cibles selon les profils, puis
// les questions ; des graphiques ; un export Excel / JSON. »
//
// La page suit maintenant ce parcours, en 3 temps :
//  1. PUBLIC ANALYSÉ : tous les répondants, le public visé de
//     l'enquête, ou des critères choisis (mêmes cases que le public visé,
//     composant AudiencePicker) ;
//  2. QUESTION : toutes, ou une seule ;
//  3. RÉSULTATS en barres horizontales, puis EXPORT (CSV pour Excel,
//     JSON) de ce qui est affiché.
//
// Analogie : un tableur avec des filtres en tête de colonne — on choisit
// d'abord QUI on regarde, puis QUOI.
//
// Le secret statistique (groupes de moins de 5 personnes masqués) et
// l'absence de texte libre dans les vues filtrées sont appliqués par
// l'API ; cette page ne fait que les afficher.
//
// Remplace l'ancien « Comparer par… » (S5-21), qui ajoutait des sous-
// résultats sous CHAQUE question sans rien filtrer.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { SITUATION_SHORT_LABELS } from '../constants/situation.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { describeAudience, isEveryone, EMPTY_AUDIENCE } from '../utils/audience.js';
import AudiencePicker from '../components/AudiencePicker/AudiencePicker.jsx';
import { downloadText } from '../utils/download.js';
import { toCsv, toJson } from '../utils/resultsExport.js';

/** Paramètres de requête du filtre « public analysé » */
function filterQuery(scope, audience) {
  if (scope === 'all') return '';
  if (scope === 'target') return '?scope=target';
  const params = new URLSearchParams({ scope: 'custom' });
  for (const [key, list] of Object.entries(audience)) if (list.length) params.set(key, list.join(','));
  return `?${params}`;
}

export default function AdminSurveyStats() {
  const { id } = useParams();

  // Résultats GLOBAUX (en-tête, répartition des profils) — chargés une fois
  const [global, setGlobal] = useState(null);
  usePageTitle(global ? `Résultats détaillés — ${global.survey.title}` : 'Résultats détaillés');

  // ① Public analysé
  const [scope, setScope] = useState('all'); // 'all' | 'target' | 'custom'
  const [customAudience, setCustomAudience] = useState(EMPTY_AUDIENCE);
  // Le filtre personnalisé ne part vers l'API qu'au clic sur « Appliquer »
  // (sinon, une requête à chaque case cochée)
  const [appliedCustom, setAppliedCustom] = useState(EMPTY_AUDIENCE);
  const [view, setView] = useState(null); // résultats du public analysé

  // ② Question affichée ('' = toutes)
  const [questionId, setQuestionId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/surveys/${id}/stats`)
      .then((data) => { setGlobal(data); setView(data); })
      .catch((err) => setError(err.message || 'Impossible de charger les résultats'))
      .finally(() => setLoading(false));
  }, [id]);

  // Nouveau public analysé → nouvelle requête (sauf « tous » : déjà chargé)
  useEffect(() => {
    if (!global) return;
    if (scope === 'all' || (scope === 'custom' && isEveryone(appliedCustom))) {
      setView(global);
      return;
    }
    setLoading(true);
    api.get(`/surveys/${id}/stats${filterQuery(scope, appliedCustom)}`)
      .then(setView)
      .catch((err) => setError(err.message || 'Impossible de filtrer les résultats'))
      .finally(() => setLoading(false));
  }, [id, scope, appliedCustom, global]);

  // « Affichée si … » : libellé de l'option-condition, à partir des résultats globaux
  const optionLookup = useMemo(() => {
    const map = new Map();
    for (const q of global?.questions ?? []) {
      for (const o of q.options ?? []) map.set(o.id, `« ${q.label} » = « ${o.label} »`);
    }
    return map;
  }, [global]);

  if (!global) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        {loading ? 'Chargement…' : (
          <>
            <p style={{ color: '#6B6257' }}>{error}</p>
            <Link to="/admin/enquetes" className="btn btn-primary" style={{ marginTop: 20 }}>Retour aux enquêtes</Link>
          </>
        )}
      </div>
    );
  }

  const publicLabel = scope === 'all'
    ? 'tous les répondants'
    : describeAudience(scope === 'target' ? global.audience : appliedCustom);
  const shownQuestions = (view?.questions ?? []).filter((q) => !questionId || q.id === questionId);

  const exportAs = (format) => {
    const date = new Date().toISOString().slice(0, 10);
    const base = `resultats-${global.survey.slug}-${date}`;
    if (format === 'csv') {
      downloadText(toCsv(view, shownQuestions, publicLabel), `${base}.csv`, 'text/csv;charset=utf-8');
    } else {
      downloadText(JSON.stringify(toJson(view, shownQuestions, publicLabel), null, 2), `${base}.json`, 'application/json');
    }
  };

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 900 }}>
      <div className="no-print">
        <Link to="/admin/enquetes" style={{ color: '#6B6257', fontSize: 14 }}>← Retour aux enquêtes</Link>
      </div>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 6px' }}>
        Résultats — {global.survey.title}
      </h1>
      <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 20 }}>
        {global.totalResponses} réponse{global.totalResponses > 1 ? 's' : ''} au total
        {' · '}public visé : {describeAudience(global.audience)}
      </p>

      <ProfileBreakdown results={global} />

      {/* ── ① Public analysé ── */}
      <section className="no-print card-joyful" style={{ padding: 20, marginBottom: 16 }} aria-labelledby="filter-title">
        <h2 id="filter-title" style={{ fontSize: 18, marginBottom: 10 }}>① Public analysé</h2>
        <div role="radiogroup" aria-labelledby="filter-title" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {[
            { value: 'all', label: 'Tous les répondants' },
            ...(global.audienceIsEveryone ? [] : [{ value: 'target', label: "Le public visé de l'enquête" }]),
            { value: 'custom', label: 'Des profils choisis…' },
          ].map((option) => (
            <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, padding: '6px 12px', border: '2px solid #e3dcce', borderRadius: 999, cursor: 'pointer', background: scope === option.value ? '#E3EEF3' : '#fff' }}>
              <input type="radio" name="scope" value={option.value} checked={scope === option.value} onChange={() => setScope(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
        {scope === 'custom' && (
          <>
            <AudiencePicker value={customAudience} onChange={setCustomAudience} />
            <button type="button" className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setAppliedCustom(customAudience)}>
              Appliquer ce filtre
            </button>
          </>
        )}
      </section>

      {/* ── ② Question ── */}
      <section className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
        <div style={{ flex: '1 1 280px' }}>
          <label htmlFor="question-select" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>② Question</label>
          <select
            id="question-select" value={questionId} onChange={(e) => setQuestionId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e3dcce', fontSize: 15 }}
          >
            <option value="">Toutes les questions</option>
            {global.questions.map((q, i) => <option key={q.id} value={q.id}>{`Q${i + 1} — ${q.label}`}</option>)}
          </select>
        </div>
        {/* ③ Export */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => exportAs('csv')} disabled={!view || view.masked}>Exporter (Excel, CSV)</button>
          <button type="button" className="btn" onClick={() => exportAs('json')} disabled={!view || view.masked}>Exporter (JSON)</button>
          <button type="button" className="btn" onClick={() => window.print()}>Imprimer / PDF</button>
        </div>
      </section>

      {/* ── Résultats ── */}
      <section aria-live="polite" aria-busy={loading}>
        <p style={{ fontSize: 15, marginBottom: 14 }}>
          <strong>Public analysé :</strong> {publicLabel}
          {view && !view.masked && ` — ${view.totalResponses} répondant${view.totalResponses > 1 ? 's' : ''}`}
        </p>

        {view?.masked && (
          <p role="status" className="card-joyful" style={{ padding: 20 }}>
            🔒 Moins de {view.minGroupSize} répondants correspondent à ce profil : leurs réponses ne sont pas affichées,
            pour qu'aucune ne puisse être attribuée à quelqu'un (secret statistique).
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!view?.masked && shownQuestions.map((question) => (
            <QuestionResult
              key={question.id}
              question={question}
              index={global.questions.findIndex((q) => q.id === question.id)}
              conditions={(question.conditionOptionIds || []).map((oid) => optionLookup.get(oid)).filter(Boolean)}
              minGroupSize={view.minGroupSize ?? 5}
            />
          ))}
        </div>
      </section>

      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          nav, header, footer { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/** Répartition des profils des répondants (vue globale) */
function ProfileBreakdown({ results }) {
  if (!results.situationBreakdown) return null;
  return (
    <details className="card-joyful" style={{ padding: '14px 20px', marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Qui a répondu ?</summary>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6 }}>
        {Object.entries(results.situationBreakdown).map(([key, count]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>{SITUATION_SHORT_LABELS[key] || key}</span><strong>{count}</strong>
          </div>
        ))}
      </div>
      {results.audienceBreakdown && !results.audienceIsEveryone && (
        <p style={{ fontSize: 14, marginTop: 10 }}>
          Dans le public visé : <strong>{results.audienceBreakdown.inAudience}</strong>
          {' · '}hors du public visé : <strong>{results.audienceBreakdown.outOfAudience}</strong>
          {' · '}profil incomplet : <strong>{results.audienceBreakdown.unknown}</strong>
        </p>
      )}
      <p style={{ fontSize: 12, color: '#6B6257', marginTop: 8 }}>
        Profil auto-déclaré par chaque citoyen (jamais vérifié), tel qu'il est aujourd'hui.
      </p>
    </details>
  );
}

/** Une question : intitulé, condition d'affichage, puis son résultat */
function QuestionResult({ question: q, index, conditions, minGroupSize }) {
  return (
    <article className="card-joyful" style={{ padding: 20 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 4 }}>
        <span style={{ color: '#6B6257', fontWeight: 400 }}>Q{index + 1} — </span>{q.label}
      </h2>
      {conditions.length > 0 && (
        <p style={{ fontSize: 13, color: '#1E5F7C', marginBottom: 8 }}>Posée si {conditions.join(' ou ')}</p>
      )}

      {q.masked ? (
        <p style={{ fontSize: 14, color: '#6B6257' }}>
          🔒 Moins de {minGroupSize} personnes concernées dans ce public — résultat masqué (secret statistique).
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: '#6B6257', marginBottom: 10 }}>
            {q.totalForQuestion} personne{q.totalForQuestion > 1 ? 's' : ''} concernée{q.totalForQuestion > 1 ? 's' : ''}
          </p>
          {q.options && <ResultBars options={q.options} />}
          {q.stats && <NumberStats stats={q.stats} />}
          {q.totalAnswered !== undefined && <FreeText question={q} />}
        </>
      )}
    </article>
  );
}

/**
 * Graphique en barres horizontales. Les barres sont décoratives
 * (aria-hidden) : chaque ligne porte AUSSI le nombre et le pourcentage
 * en texte — un lecteur d'écran lit « Oui : 9 réponses, 75 % », et
 * l'information ne repose jamais sur la seule longueur d'une barre
 * (RGAA 3.1).
 */
export function ResultBars({ options }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((o) => (
        <li key={o.id ?? o.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, marginBottom: 4 }}>
            <span>{o.label}</span>
            <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
              {o.count} <span style={{ fontWeight: 400, color: '#6B6257' }}>({o.percentage} %)</span>
            </span>
          </div>
          <div aria-hidden="true" style={{ height: 12, background: '#EFEBE2', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, o.percentage)}%`, height: '100%', background: '#1E5F7C', borderRadius: 6 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function NumberStats({ stats }) {
  const items = [
    ['Réponses', stats.count],
    ['Moyenne', stats.average !== null ? Math.round(stats.average * 10) / 10 : null],
    ['Minimum', stats.min],
    ['Maximum', stats.max],
  ].filter(([, value]) => value !== null && value !== undefined);
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, margin: 0 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ background: '#F6F1E7', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
          <dt style={{ fontSize: 12, color: '#6B6257' }}>{label}</dt>
          <dd style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * TEXTE_LIBRE : le NOMBRE de réponses toujours ; le contenu brut
 * seulement dans la vue « tous les répondants » (l'API ne l'envoie
 * jamais dans une vue filtrée), et jamais imprimé ni exporté.
 */
function FreeText({ question: q }) {
  return (
    <div>
      <p style={{ fontSize: 14, marginBottom: 6 }}>
        {q.totalAnswered} réponse{q.totalAnswered > 1 ? 's' : ''} libre{q.totalAnswered > 1 ? 's' : ''}
      </p>
      {q.answers?.length > 0 && (
        <>
          <details className="no-print">
            <summary style={{ cursor: 'pointer', fontSize: 14 }}>Lire les réponses</summary>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {q.answers.map((text, i) => <li key={i} style={{ fontSize: 14 }}>{text}</li>)}
            </ul>
          </details>
          <p className="print-only" style={{ fontSize: 12, color: '#6B6257', fontStyle: 'italic' }}>
            Contenu des réponses libres non reproduit dans ce document (données potentiellement identifiantes).
          </p>
        </>
      )}
    </div>
  );
}
