// ══════════════════════════════════════════════════════════
// Page Admin — liste des propositions (tous statuts)
//
// C'est le tableau de bord de l'administratrice : contrairement
// à /propositions (public), on voit ICI les brouillons, les
// propositions en attente de relecture, rejetées, etc.
//
// Analogie : /propositions, c'est la salle du restaurant ouverte
// au public. Cette page-ci, c'est le cahier de cuisine — on y
// voit aussi les plats encore en préparation, pas prêts à sortir.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { STATUS_META } from '../constants/proposalStatus.js';

const FILTERS = [
  { value: undefined, label: 'Toutes' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'PENDING_REVIEW', label: 'En attente' },
  { value: 'PUBLISHED', label: 'Publiées' },
  { value: 'REJECTED', label: 'Rejetées' },
  { value: 'CLOSED', label: 'Clôturées' },
  { value: 'ARCHIVED', label: 'Archivées' },
];

export default function AdminPropositions() {
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
      const data = await api.get(`/proposals/admin?${params.toString()}`);
      setItems(data.items);
    } catch (err) {
      setError(err.message || 'Impossible de charger les propositions');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (proposal) => {
    // window.confirm : suffisant pour un outil d'administration
    // interne — pas besoin d'une modale personnalisée ici, ce
    // n'est pas une action qu'un citoyen verra jamais.
    if (!window.confirm(`Supprimer définitivement « ${proposal.title} » ?`)) return;

    try {
      await api.delete(`/proposals/${proposal.id}`);
      setItems((prev) => prev.filter((p) => p.id !== proposal.id));
    } catch (err) {
      setError(err.message || 'La suppression a échoué');
    }
  };

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28 }}>
          Administration — Propositions
        </h1>
        <Link to="/admin/propositions/nouvelle" className="btn btn-primary">
          + Nouvelle proposition
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
        <p style={{ color: '#6B6257' }}>Aucune proposition pour ce filtre.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((p) => {
            const meta = STATUS_META[p.status];
            return (
              <div
                key={p.id}
                className="card-joyful"
                style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
              >
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  color: meta.color, background: meta.bg, whiteSpace: 'nowrap',
                }}>
                  {meta.label}
                </span>

                <span style={{ flex: 1, minWidth: 200, fontWeight: 600 }}>{p.title}</span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Link
                    to={`/admin/propositions/${p.slug}/modifier`}
                    className="btn"
                    style={{ background: '#EFEBE2', color: '#26333A', padding: '8px 16px', minHeight: 40, fontSize: 14 }}
                  >
                    Modifier
                  </Link>
                  <button
                    onClick={() => handleDelete(p)}
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
