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
  // On transmet tout ce que la page envoie (pas de filtrage explicite
  // ici) — sinon chaque nouveau champ d'inscription (ex. situation)
  // doit être ajouté à DEUX endroits : la page ET ce pont vers l'API,
  // avec le risque de silencieusement en oublier un, comme ici.
  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    return data; // le message "vérifiez votre email"
  }, []);

  // ── Connexion ──────────────────────────────────────────
  // Si data.twoFactorRequired est vrai (compte admin), on ne stocke
  // NI token NI user — l'appelant (Connexion.jsx) doit d'abord
  // passer par verifyTwoFactor() avec le code reçu par email.
  // ── Connexion ──────────────────────────────────────────
  // Si data.twoFactorRequired est vrai (compte admin), on ne stocke
  // NI token NI user — l'appelant (Connexion.jsx) doit d'abord
  // passer par verifyTwoFactor() avec le code reçu par email.
  //
  // trustedDeviceToken (s'il existe encore en localStorage, posé par
  // un précédent verifyTwoFactor sur CE navigateur) est envoyé à
  // chaque tentative — c'est lui qui permet à l'API de sauter le
  // défi email si ce navigateur l'a déjà passé il y a moins d'1h.
  // Ne coûte rien à envoyer même pour un citoyen normal ou un admin
  // jamais encore vérifié : l'API l'ignore simplement s'il ne
  // correspond à rien.
  const login = useCallback(async ({ email, password }) => {
    const trustedDeviceToken = localStorage.getItem('trustedDeviceToken') || undefined;
    const data = await api.post('/auth/login', { email, password, trustedDeviceToken });
    if (!data.twoFactorRequired) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
    }
    return data;
  }, []);

  // ── Deuxième étape de connexion (2FA admin) ─────────────
  const verifyTwoFactor = useCallback(async ({ challengeToken, code }) => {
    const data = await api.post('/auth/2fa/verify', { challengeToken, code });
    localStorage.setItem('token', data.token);
    // Posé pour la PROCHAINE connexion sur ce navigateur (voir
    // login() ci-dessus) — jamais utilisé pour la session en cours,
    // qui repose entièrement sur data.token comme d'habitude.
    if (data.trustedDeviceToken) {
      localStorage.setItem('trustedDeviceToken', data.trustedDeviceToken);
    }
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
      register, login, verifyTwoFactor, logout, refreshUser,
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