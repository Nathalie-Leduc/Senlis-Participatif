// ══════════════════════════════════════════════════════════
// Page Admin — gestion des comptes
//
// Volontairement minimal pour l'instant : juste de quoi changer le
// rôle d'un compte sans toucher à la base à la main.
//
// S5R2-11 : trois rôles au lieu de deux — Citoyen, Admin-test
// (EDITOR : prépare et teste des brouillons, pour la mairie ou un
// partenaire) et Administrateur. Un menu déroulant remplace l'ancien
// bouton « Promouvoir / Rétrograder », qui ne savait faire qu'un
// aller-retour entre deux rôles. La vraie hiérarchie de rôles
// (salarié mairie, maisons de quartier, délégués...) reste l'offre F1.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { ROLE_META, ROLE_OPTIONS } from '../constants/roles.js';

export default function AdminUsers() {
  usePageTitle('Administration — Comptes');
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (search.trim()) params.set('search', search.trim());
      const data = await api.get(`/admin/users?${params.toString()}`);
      setItems(data.items);
    } catch (err) {
      setError(err.message || 'Impossible de charger les comptes');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // Léger anti-rebond : pas une requête à chaque frappe.
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleChangeRole = async (targetUser, newRole) => {
    if (newRole === targetUser.role) return;
    const meta = ROLE_META[newRole];
    // Confirmation qui dit CE QUE le rôle permet — on ne donne pas des
    // droits à la légère (et le menu déroulant se change d'un clic)
    const question = `Passer « ${targetUser.pseudo} » (${targetUser.email}) en ${meta.label} — ${meta.description} ?`;
    if (!window.confirm(question)) return;

    try {
      const data = await api.patch(`/admin/users/${targetUser.id}`, { role: newRole });
      setItems((prev) => prev.map((u) => (u.id === targetUser.id ? data.user : u)));
      showToast(`${targetUser.pseudo} est maintenant ${meta.label}`);
    } catch (err) {
      showToast(err.message || 'La mise à jour a échoué');
    }
  };

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px' }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, marginBottom: 6 }}>
        Gestion des comptes
      </h1>
      <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 20 }}>
        Changer le rôle d'un compte : Citoyen, Admin-test (prépare et teste des brouillons,
        ne publie jamais) ou Administrateur.
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par email ou pseudo..."
        style={{
          width: '100%', maxWidth: 400, padding: '10px 16px', fontSize: 15,
          border: '2px solid #e3dcce', borderRadius: 12, marginBottom: 20,
          fontFamily: "'Public Sans', system-ui",
        }}
      />

      {loading && <p>Chargement…</p>}
      {error && <p role="alert" style={{ color: '#A8442F' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && <p style={{ color: '#6B6257' }}>Aucun compte trouvé.</p>}
          {items.map((u) => {
            const isSelf = u.id === currentUser?.id;
            const meta = ROLE_META[u.role] ?? ROLE_META.CITIZEN;
            const selectId = `role-${u.id}`;
            return (
              <div
                key={u.id}
                className="card-joyful"
                style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
              >
                <div>
                  <strong>{u.pseudo}</strong>
                  <span style={{ color: '#6B6257', marginLeft: 8, fontSize: 14 }}>{u.email}</span>
                  {!u.emailVerified && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#A8442F' }}>· email non vérifié</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                      background: meta.bg, color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                  {/* Étiquette visible seulement des lecteurs d'écran : le
                      pseudo dit À QUI s'applique ce menu (RGAA 11.1) */}
                  <label htmlFor={selectId} className="sr-only">Rôle de {u.pseudo}</label>
                  <select
                    id={selectId}
                    value={u.role}
                    onChange={(e) => handleChangeRole(u, e.target.value)}
                    disabled={isSelf}
                    title={isSelf ? 'Impossible de modifier votre propre compte' : undefined}
                    style={{
                      padding: '8px 12px', minHeight: 40, fontSize: 14, borderRadius: 10,
                      border: '2px solid #e3dcce', font: 'inherit',
                      opacity: isSelf ? 0.5 : 1, cursor: isSelf ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
