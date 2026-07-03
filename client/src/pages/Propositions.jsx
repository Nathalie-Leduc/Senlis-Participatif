// ══════════════════════════════════════════════════════════
// Page Propositions — /propositions
//
// Liste publique, avec :
// - un filtre de statut (Toutes / En concertation / Clôturées)
// - un tri (Plus récentes / Plus votées)
// - une pagination "Voir plus" (pas de numéros de page — plus
//   simple au pouce et pour les seniors, voir 10-wireframes.html)
//
// Analogie pour le "Voir plus" : c'est une vitrine de magasin,
// pas un catalogue papier. On continue à dérouler la même liste
// vers le bas plutôt que de tourner une page qui recommencerait
// en haut — on ne perd jamais sa place.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import ProposalCard from '../components/ProposalCard/ProposalCard.jsx';
import Mascot from '../components/Mascot/Mascot.jsx';

const STATUS_FILTERS = [
  { value: undefined, label: 'Toutes' },
  { value: 'PUBLISHED', label: 'En concertation' },
  { value: 'CLOSED', label: 'Clôturées' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'votes', label: 'Plus votées' },
];

export default function Propositions() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState(undefined);
  const [sort, setSort] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Construit l'URL de requête à partir des filtres actuels.
  // useCallback évite de recréer cette fonction à chaque rendu,
  // ce qui casserait la dépendance du useEffect plus bas.
  const buildQuery = useCallback((pageToFetch) => {
    const params = new URLSearchParams({ page: pageToFetch, limit: 10, sort });
    if (status) params.set('status', status);
    return `/proposals?${params.toString()}`;
  }, [status, sort]);

  // Quand le statut ou le tri change, on repart de la page 1 —
  // continuer à empiler des résultats "page 3" sur un NOUVEAU
  // filtre n'aurait pas de sens (mélange de deux listes différentes).
  useEffect(() => {
    let cancelled = false; // évite d'écraser un état plus récent
                            // si une requête plus lente arrive en retard
    setLoading(true);
    setError(null);

    api.get(buildQuery(1))
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setPage(1);
        setTotalPages(data.pagination.totalPages);
      })
      .catch((err) => !cancelled && setError(err.message || 'Impossible de charger les propositions'))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [buildQuery]);

  // "Voir plus" : on ajoute la page suivante à la liste existante,
  // au lieu de la remplacer.
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
      {/* ── En-tête de section ──────────────────────────── */}
      <div className="section-proposals" style={{ padding: '48px 20px 32px' }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <Mascot size="section" />
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, margin: '12px 0 6px' }}>
            Propositions en concertation
          </h1>
          <p style={{ color: '#26333A', fontSize: 17 }}>
            « Votre avis façonne Senlis — votez maintenant ! »
          </p>
        </div>
      </div>

      <div className="wrap" style={{ padding: '28px 20px 60px' }}>
        {/* ── Filtres ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
          {STATUS_FILTERS.map((f) => (
            <FilterPill
              key={f.label}
              active={status === f.value}
              onClick={() => setStatus(f.value)}
              label={f.label}
            />
          ))}

          {/* Séparateur visuel léger entre les deux groupes de filtres */}
          <span style={{ width: 1, background: '#e3dcce', margin: '4px 4px' }} />

          {SORT_OPTIONS.map((s) => (
            <FilterPill
              key={s.value}
              active={sort === s.value}
              onClick={() => setSort(s.value)}
              label={s.label}
            />
          ))}
        </div>

        {/* ── Erreur réseau ────────────────────────────────── */}
        {error && (
          <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* ── État vide (aucune proposition pour ce filtre) ─── */}
        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Mascot size="inline" speech="Rien par ici pour l'instant !" />
            <p style={{ color: '#6B6257', marginTop: 16 }}>
              Aucune proposition ne correspond à ce filtre pour le moment.
            </p>
          </div>
        )}

        {/* ── Liste des cartes ─────────────────────────────── */}
        {items.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}

        {/* ── Voir plus ─────────────────────────────────────── */}
        {page < totalPages && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              onClick={loadMore}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Chargement…' : 'Voir plus'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Petit composant local : un bouton-filtre en forme de pilule ──
// Pas dans un fichier séparé : trop petit et trop spécifique à
// cette page pour mériter son propre composant réutilisable.
function FilterPill({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      // aria-pressed indique aux lecteurs d'écran qu'il s'agit d'un
      // bouton à bascule (actif/inactif), pas d'une simple action —
      // même logique que les boutons de vote sur la page détail.
      aria-pressed={active}
      style={{
        padding: '8px 18px',
        borderRadius: 999,
        border: `2px solid ${active ? '#1E5F7C' : '#e3dcce'}`,
        background: active ? '#1E5F7C' : '#fff',
        color: active ? '#fff' : '#26333A',
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        minHeight: 40,
      }}
    >
      {label}
    </button>
  );
}
