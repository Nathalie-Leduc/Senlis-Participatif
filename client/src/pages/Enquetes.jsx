// ══════════════════════════════════════════════════════════
// Page Enquêtes — /enquetes
//
// Version simplifiée de Propositions.jsx (même principe de liste
// + filtre + "Voir plus") : pas de tri par votes ici, une enquête
// n'a pas d'équivalent direct au nombre de votes tant qu'on n'est
// pas entré dedans.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';

const STATUS_FILTERS = [
  { value: undefined, label: 'Toutes' },
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'CLOSED', label: 'Clôturées' },
];

export default function Enquetes() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const buildQuery = useCallback((pageToFetch) => {
    const params = new URLSearchParams({ page: pageToFetch, limit: 10 });
    if (status) params.set('status', status);
    return `/surveys?${params.toString()}`;
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get(buildQuery(1))
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setPage(1);
        setTotalPages(data.pagination.totalPages);
      })
      .catch((err) => !cancelled && setError(err.message || 'Impossible de charger les enquêtes'))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [buildQuery]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const data = await api.get(buildQuery(nextPage));
      setItems((prev) => [...prev, ...data.items]);
      setPage(nextPage);
    } catch (err) {
      setError(err.message || 'Impossible de charger la suite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="section-proposals" style={{ padding: '48px 20px 32px' }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <Mascot size="section" />
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, margin: '12px 0 6px' }}>
            Enquêtes
          </h1>
          <p style={{ color: '#26333A', fontSize: 17 }}>
            « Votre expérience compte — répondez en quelques minutes »
          </p>
        </div>
      </div>

      <div className="wrap" style={{ padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
          {STATUS_FILTERS.map((f) => (
            <FilterPill key={f.label} active={status === f.value} onClick={() => setStatus(f.value)} label={f.label} />
          ))}
        </div>

        {error && (
          <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Mascot size="inline" speech="Rien par ici pour l'instant !" />
            <p style={{ color: '#6B6257', marginTop: 16 }}>
              Aucune enquête ne correspond à ce filtre pour le moment.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((survey) => (
            <Link
              key={survey.id}
              to={`/enquetes/${survey.slug}`}
              className="card-joyful"
              style={{ padding: 18, display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                color: survey.status === 'OPEN' ? '#3A7A4D' : '#1E5F7C',
                background: survey.status === 'OPEN' ? '#E0F2E5' : '#E3EEF3',
              }}>
                {survey.status === 'OPEN' ? 'Ouverte' : 'Clôturée'}
              </span>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: '10px 0 6px' }}>
                {survey.title}
              </h2>
              <p style={{ color: '#6B6257', fontSize: 15 }}>{survey.description}</p>
            </Link>
          ))}
        </div>

        {page < totalPages && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={loadMore} disabled={loading} className="btn btn-primary">
              {loading ? 'Chargement…' : 'Voir plus'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '8px 18px', borderRadius: 999,
        border: `2px solid ${active ? '#1E5F7C' : '#e3dcce'}`,
        background: active ? '#1E5F7C' : '#fff',
        color: active ? '#fff' : '#26333A',
        fontWeight: 600, fontSize: 14, cursor: 'pointer', minHeight: 40,
      }}
    >
      {label}
    </button>
  );
}
