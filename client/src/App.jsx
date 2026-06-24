// ══════════════════════════════════════════════════════════
// App — Point d'entrée React
//
// Sprint 0 : squelette minimal avec le hero joyeux et la
// mascotte.
// Sprint 1 : auth complet + hero joyeux.
// Les routes propositions/enquêtes/carte arriveront aux
// sprints suivants — les <Link> dans la nav sont déjà prêts.
// ══════════════════════════════════════════════════════════

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import Header from './components/Header/Header.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';

// Pages
import Accueil from './pages/Accueil.jsx';
import Inscription from './pages/Inscription.jsx';
import Connexion from './pages/Connexion.jsx';
import VerificationEmail from './pages/VerificationEmail.jsx';
import MotDePasseOublie from './pages/MotDePasseOublie.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import MonCompte from './pages/MonCompte.jsx';
import Mascot from './components/Mascot/Mascot.jsx';

// Page 404 avec mascotte perdue 🦌
function NotFound() {
  return (
    <div className="wrap" style={{ padding: '80px 20px', textAlign: 'center' }}>
      <Mascot size="section" speech="Je me suis perdu dans la forêt… 🌲" />
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, margin: '20px 0 8px' }}>
        Page introuvable
      </h1>
      <p style={{ color: '#6B6257', fontSize: 17 }}>
        Cette page n'existe pas — retournons à l'accueil !
      </p>
      <a href="/" className="btn btn-primary" style={{ marginTop: 24 }}>
        Retour à l'accueil
      </a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Skip link : premier élément focusable (accessibilité) */}
        <a href="#main" className="skip-link">Aller au contenu</a>

        <Header />

        <main id="main">
          <Routes>
            {/* Routes publiques */}
            <Route path="/" element={<Accueil />} />
            <Route path="/inscription" element={<Inscription />} />
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/verification-email" element={<VerificationEmail />} />
            <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Routes protégées */}
            <Route path="/mon-compte" element={
              <ProtectedRoute><MonCompte /></ProtectedRoute>
            } />

            {/* Sprint 2 → /propositions, /propositions/:slug */}
            {/* Sprint 3 → /carte */}
            {/* Sprint 4 → /enquetes, /enquetes/:slug */}

            {/* 404 — le cerf est perdu 🦌 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer style={{
          background: '#26333A', color: 'rgba(255,255,255,0.6)',
          padding: '28px 20px', textAlign: 'center', fontSize: 14,
        }}>
          <p><strong style={{ color: '#F0C45A' }}>Senlis Participatif</strong> · Plateforme citoyenne indépendante</p>
          <p style={{ marginTop: 4 }}>🦌 Aucun cerf n'a été blessé pendant la fabrication de ce site</p>
        </footer>
      </AuthProvider>
    </BrowserRouter>
  );
}