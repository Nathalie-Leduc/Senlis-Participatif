// ══════════════════════════════════════════════════════════
// App — Point d'entrée React
//
// Sprint 0 : squelette minimal avec le hero joyeux et la
// mascotte.
// Sprint 1 : auth complet + hero joyeux.
// Les routes propositions/enquêtes/carte arriveront aux
// sprints suivants — les <Link> dans la nav sont déjà prêts.
// ══════════════════════════════════════════════════════════

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { AccessibilityProvider } from './contexts/AccessibilityContext.jsx';
import AccessibilityWidget from './components/AccessibilityWidget/AccessibilityWidget.jsx';
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
import Propositions from './pages/Propositions.jsx';
import PropositionDetail from './pages/PropositionDetail.jsx';
import AdminPropositions from './pages/AdminPropositions.jsx';
import AdminPropositionForm from './pages/AdminPropositionForm.jsx';
import AdminSurveys from './pages/AdminSurveys.jsx';
import AdminSurveyForm from './pages/AdminSurveyForm.jsx';
import Enquetes from './pages/Enquetes.jsx';
import EnqueteDetail from './pages/EnqueteDetail.jsx';
import EnqueteRepondre from './pages/EnqueteRepondre.jsx';
import EnqueteResultats from './pages/EnqueteResultats.jsx';
import MentionsLegales from './pages/MentionsLegales.jsx';
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite.jsx';
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
      <AccessibilityProvider>
      <AuthProvider>
        {/* Skip link : premier élément focusable (accessibilité) */}
        <a href="#main" className="skip-link">Aller au contenu</a>

        <AccessibilityWidget />

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
            <Route path="/propositions" element={<Propositions />} />
            <Route path="/propositions/:slug" element={<PropositionDetail />} />
            <Route path="/enquetes" element={<Enquetes />} />
            <Route path="/enquetes/:slug" element={<EnqueteDetail />} />
            <Route path="/enquetes/:slug/resultats" element={<EnqueteResultats />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/confidentialite" element={<PolitiqueConfidentialite />} />

            {/* Routes protégées */}
            <Route path="/mon-compte" element={
              <ProtectedRoute><MonCompte /></ProtectedRoute>
            } />
            <Route path="/admin/propositions" element={
              <ProtectedRoute adminOnly><AdminPropositions /></ProtectedRoute>
            } />
            <Route path="/admin/propositions/nouvelle" element={
              <ProtectedRoute adminOnly><AdminPropositionForm /></ProtectedRoute>
            } />
            <Route path="/admin/propositions/:slug/modifier" element={
              <ProtectedRoute adminOnly><AdminPropositionForm /></ProtectedRoute>
            } />
            <Route path="/admin/enquetes" element={
              <ProtectedRoute adminOnly><AdminSurveys /></ProtectedRoute>
            } />
            <Route path="/admin/enquetes/nouvelle" element={
              <ProtectedRoute adminOnly><AdminSurveyForm /></ProtectedRoute>
            } />
            <Route path="/admin/enquetes/:slug/modifier" element={
              <ProtectedRoute adminOnly><AdminSurveyForm /></ProtectedRoute>
            } />
            {/* adminOnly absent : n'importe quel citoyen CONNECTÉ peut
                répondre — pas réservé aux admins. La vérification email
                (UC-02), elle, est gérée DANS EnqueteRepondre, pas ici :
                ProtectedRoute ne connaît que le rôle, pas emailVerified. */}
            <Route path="/enquetes/:slug/repondre" element={
              <ProtectedRoute><EnqueteRepondre /></ProtectedRoute>
            } />

            {/* Sprint 3 → /carte */}

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
          <p style={{ marginTop: 12 }}>
            <Link to="/mentions-legales" style={{ color: 'rgba(255,255,255,0.75)' }}>Mentions légales</Link>
            {' · '}
            <Link to="/confidentialite" style={{ color: 'rgba(255,255,255,0.75)' }}>Politique de confidentialité</Link>
          </p>
        </footer>
      </AuthProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  );
}