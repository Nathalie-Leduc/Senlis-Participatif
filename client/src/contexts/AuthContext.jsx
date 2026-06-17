// ══════════════════════════════════════════════════════════
// Contexte Auth — le "passeport" global de l'application
//
// Ce contexte encapsule tout ce qui concerne l'identité :
// qui est connecté, comment se connecter/déconnecter,
// le token JWT stocké en localStorage.
//
// Tout composant qui a besoin de savoir "est-on connecté ?"
// fait : const { user, isLogged } = useAuth();
//
// Analogie : c'est le badge d'accès de l'immeuble. Tu le
// scannes (login), il te suit partout (contexte React), et
// tu peux le rendre (logout).
// ══════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true pendant le check initial

  // Au montage : si un token existe en localStorage, on vérifie
  // qu'il est encore valide en appelant /auth/me.
  // Si le token est expiré, on le supprime silencieusement.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  // ── Inscription ────────────────────────────────────────
  const register = useCallback(async ({ email, password, pseudo }) => {
    const data = await api.post('/auth/register', { email, password, pseudo });
    return data; // le message "vérifiez votre email"
  }, []);

  // ── Connexion ──────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  }, []);

  // ── Déconnexion ────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  // ── Rafraîchir le profil ───────────────────────────────
  const refreshUser = useCallback(async () => {
    const data = await api.get('/auth/me');
    setUser(data.user);
  }, []);

  const isLogged = !!user;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{
      user, isLogged, isAdmin, loading,
      register, login, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook pour accéder au contexte Auth depuis n'importe quel composant.
 * Usage : const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un <AuthProvider>');
  }
  return context;
}
