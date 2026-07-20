// ══════════════════════════════════════════════════════════
// Page Admin — liste des enquêtes (tous statuts)
//
// Même structure que AdminPropositions.jsx — même principe de
// "cahier de cuisine" : on y voit aussi les brouillons, pas
// seulement les enquêtes déjà ouvertes.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { STATUS_META } from '../constants/surveyStatus.js';

const FILTERS = [
  { value: undefined, label: 'Toutes' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'CLOSED', label: 'Clôturées' },
];

export default function AdminSurveys() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (status) params.set('status', status);
      const data = await api.get(`/surveys/admin?${params.toString()}`);
      setItems(data.items);
    } catch (err) {
      setError(err.message || 'Impossible de charger les enquêtes');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (survey) => {
    if (!window.confirm(`Supprimer définitivement « ${survey.title} » ?`)) return;

    try {
      await api.delete(`/surveys/${survey.id}`);
      setItems((prev) => prev.filter((s) => s.id !== survey.id));
    } catch (err) {
      // Ex. 409 SURVEY_HAS_RESPONSES si l'enquête a déjà des réponses —
      // le message renvoyé par l'API est déjà explicite, on l'affiche tel quel.
      setError(err.message || 'La suppression a échoué');
    }
  };

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28 }}>
          Administration — Enquêtes
        </h1>
        <Link to="/admin/enquetes/nouvelle" className="btn btn-primary">
          + Nouvelle enquête
        </Link>
      </div>

      {/* ── Filtres par statut ───────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatus(f.value)}
            aria-pressed={status === f.value}
            style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
              border: `2px solid ${status === f.value ? '#1E5F7C' : '#e3dcce'}`,
              background: status === f.value ? '#1E5F7C' : '#fff',
              color: status === f.value ? '#fff' : '#26333A',
              cursor: 'pointer', minHeight: 36,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B6257' }}>Chargement…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#6B6257' }}>Aucune enquête pour ce filtre.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((s) => {
            const meta = STATUS_META[s.status];
            return (
              <div
                key={s.id}
                className="card-joyful"
                style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
              >
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  color: meta.color, background: meta.bg, whiteSpace: 'nowrap',
                }}>
                  {meta.label}
                </span>

                <span style={{ flex: 1, minWidth: 200, fontWeight: 600 }}>{s.title}</span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Link
                    to={`/admin/enquetes/${s.slug}/modifier`}
                    className="btn"
                    style={{ background: '#EFEBE2', color: '#26333A', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                  >
                    Modifier
                  </Link>
                  <button
                    onClick={() => handleDelete(s)}
                    className="btn"
                    style={{ background: '#FCEAE6', color: '#A8442F', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
