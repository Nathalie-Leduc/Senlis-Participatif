// ══════════════════════════════════════════════════════════
// ProtectedRoute — garde-fou des routes privées
//
// Encapsule les routes qui nécessitent une connexion.
// Si l'utilisateur n'est pas connecté, il est redirigé
// vers /connexion. Si adminOnly est true, il faut aussi
// le rôle ADMIN.
//
// Usage dans App.jsx :
//   <Route path="/mon-compte" element={
//     <ProtectedRoute><MonCompte /></ProtectedRoute>
//   } />
// ══════════════════════════════════════════════════════════

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isLogged, isAdmin, loading } = useAuth();

  // Pendant le check initial du token, on ne redirige pas
  // (sinon on flashe la page de connexion puis la vraie page)
  if (loading) return null;

  if (!isLogged) {
    return <Navigate to="/connexion" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
