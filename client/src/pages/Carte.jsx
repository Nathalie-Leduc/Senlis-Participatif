// ══════════════════════════════════════════════════════════
// Page « Carte » (S5R-11) — la carte « Explorer » en grand
//
// La maquette prévoyait une entrée « Carte » dans le menu : la voici.
// Même composant que sur l'accueil (ExploreMap), avec plus de place.
// ══════════════════════════════════════════════════════════

import ExploreMap from '../components/ExploreMap/ExploreMap.jsx';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Carte() {
  usePageTitle('Carte des quartiers');
  const { isStaff } = useAuth();

  return (
    // Pleine largeur (pas de .wrap) : retour du 07/10 — la page devait
    // être nettement plus grande que la carte de l'accueil
    <div style={{ padding: '16px 20px 24px' }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, marginBottom: 4 }}>Carte des quartiers</h1>
      <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 12 }}>
        Propositions et enquêtes en cours, quartier par quartier, et les parkings de la ville.
        {/* S5R2-05 : l'équipe passe directement à la gestion des parkings */}
        {isStaff && <> · <Link to="/admin/parkings">Gérer les parkings</Link></>}
      </p>
      <ExploreMap fullPage />
    </div>
  );
}
