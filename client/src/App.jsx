// ══════════════════════════════════════════════════════════
// App — Point d'entrée React
//
// Sprint 0 : squelette minimal avec le hero joyeux et la
// mascotte.
// Sprint 1 : auth complet + hero joyeux.
// Les routes propositions/enquêtes/carte arriveront aux
// sprints suivants — les <Link> dans la nav sont déjà prêts.
// ══════════════════════════════════════════════════════════

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { AccessibilityProvider } from './contexts/AccessibilityContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import AccessibilityWidget from './components/AccessibilityWidget/AccessibilityWidget.jsx';
import MascotWidget from './components/MascotWidget/MascotWidget.jsx';
import Header from './components/Header/Header.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';
import Mascot from './components/Mascot/Mascot.jsx';

// ── Pages, chargées à la demande (découpage par route) ───
//
// Audit Lighthouse (S5-08) : les 18 pages étaient TOUTES importées
// d'un bloc en haut de ce fichier — un premier visiteur sur
// l'accueil téléchargeait donc aussi tout le code de l'admin, de
// l'authentification, des enquêtes... jamais utilisé pour lui.
// React.lazy() + Suspense découpe chaque page en son propre fichier
// JS, chargé uniquement au moment où la route correspondante est
// visitée — le lot initial ne contient plus que la coquille (en-tête,
// pied de page, widgets) commune à toutes les pages.
const Accueil = lazy(() => import('./pages/Accueil.jsx'));
const Inscription = lazy(() => import('./pages/Inscription.jsx'));
const Connexion = lazy(() => import('./pages/Connexion.jsx'));
const VerificationEmail = lazy(() => import('./pages/VerificationEmail.jsx'));
const MotDePasseOublie = lazy(() => import('./pages/MotDePasseOublie.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const MonCompte = lazy(() => import('./pages/MonCompte.jsx'));
const Propositions = lazy(() => import('./pages/Propositions.jsx'));
const PropositionDetail = lazy(() => import('./pages/PropositionDetail.jsx'));
const AdminPropositions = lazy(() => import('./pages/AdminPropositions.jsx'));
const AdminPropositionForm = lazy(() => import('./pages/AdminPropositionForm.jsx'));
const AdminSurveys = lazy(() => import('./pages/AdminSurveys.jsx'));
const AdminSurveyStats = lazy(() => import('./pages/AdminSurveyStats.jsx'));
const AdminSurveyForm = lazy(() => import('./pages/AdminSurveyForm.jsx'));
const Enquetes = lazy(() => import('./pages/Enquetes.jsx'));
const EnqueteDetail = lazy(() => import('./pages/EnqueteDetail.jsx'));
const EnqueteRepondre = lazy(() => import('./pages/EnqueteRepondre.jsx'));
const EnqueteResultats = lazy(() => import('./pages/EnqueteResultats.jsx'));
const MentionsLegales = lazy(() => import('./pages/MentionsLegales.jsx'));
const PolitiqueConfidentialite = lazy(() => import('./pages/PolitiqueConfidentialite.jsx'));

// Affiché le temps de télécharger le code de la page ciblée — sur
// une bonne connexion, cette étape dure quelques dizaines de
// millisecondes, à peine perceptible ; elle évite surtout un écran
// blanc plus long le temps que le fichier arrive.
function RouteFallback() {
  return (
    <div className="wrap" style={{ padding: '80px 20px', textAlign: 'center', color: '#6B6257' }}>
      Chargement…
    </div>
  );
}

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
      <ToastProvider>
      <AuthProvider>
        {/* Skip link : premier élément focusable (accessibilité) */}
        <a href="#main" className="skip-link">Aller au contenu</a>

        <AccessibilityWidget />
        <MascotWidget />

        <Header />

        <main id="main">
          <Suspense fallback={<RouteFallback />}>
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
            <Route path="/admin/enquetes/:id/stats" element={
              <ProtectedRoute adminOnly><AdminSurveyStats /></ProtectedRoute>
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
          </Suspense>
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
      </ToastProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  );
}