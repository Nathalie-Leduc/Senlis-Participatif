// ══════════════════════════════════════════════════════════
// Page Admin — gestion des comptes
//
// Volontairement minimal pour l'instant : juste de quoi promouvoir
// un citoyen en admin (ex. faire tester un proche) sans toucher à
// la base à la main. La vraie hiérarchie de rôles (salarié mairie,
// maisons de quartier, délégués...) reste un chantier à part.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

export default function AdminUsers() {
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

  const handleToggleRole = async (targetUser) => {
    const promoting = targetUser.role !== 'ADMIN';
    const newRole = promoting ? 'ADMIN' : 'CITIZEN';
    const question = promoting
      ? `Promouvoir « ${targetUser.pseudo} » (${targetUser.email}) administrateur ?`
      : `Rétrograder « ${targetUser.pseudo} » (${targetUser.email}) en citoyen ?`;
    if (!window.confirm(question)) return;

    try {
      const data = await api.patch(`/admin/users/${targetUser.id}`, { role: newRole });
      setItems((prev) => prev.map((u) => (u.id === targetUser.id ? data.user : u)));
      showToast(promoting ? `${targetUser.pseudo} est maintenant administrateur` : `${targetUser.pseudo} est de nouveau citoyen`);
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
        Promouvoir un citoyen en administrateur, ou rétrograder un compte.
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
      {error && <p style={{ color: '#A8442F' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && <p style={{ color: '#6B6257' }}>Aucun compte trouvé.</p>}
          {items.map((u) => {
            const isSelf = u.id === currentUser?.id;
            const isAdmin = u.role === 'ADMIN';
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
                    style={{
                      fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                      background: isAdmin ? '#E3EEF3' : '#EFEBE2',
                      color: isAdmin ? '#1E5F7C' : '#26333A',
                    }}
                  >
                    {isAdmin ? 'Administrateur' : 'Citoyen'}
                  </span>
                  <button
                    onClick={() => handleToggleRole(u)}
                    disabled={isSelf}
                    title={isSelf ? 'Impossible de modifier votre propre compte' : undefined}
                    className="btn"
                    style={{
                      background: isAdmin ? '#FCEAE6' : '#E0F2E5',
                      color: isAdmin ? '#A8442F' : '#377349',
                      padding: '8px 16px', minHeight: 40, fontSize: 14,
                      opacity: isSelf ? 0.5 : 1, cursor: isSelf ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isAdmin ? 'Rétrograder' : 'Promouvoir admin'}
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
