// ══════════════════════════════════════════════════════════
// Page « Carte » (S5R-11) — la carte « Explorer » en grand
//
// La maquette prévoyait une entrée « Carte » dans le menu : la voici.
// Même composant que sur l'accueil (ExploreMap), avec plus de place.
// ══════════════════════════════════════════════════════════

import ExploreMap from '../components/ExploreMap/ExploreMap.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';

export default function Carte() {
  usePageTitle('Carte des quartiers');

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px' }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, marginBottom: 6 }}>Carte des quartiers</h1>
      <p style={{ color: '#6B6257', fontSize: 17, marginBottom: 20 }}>
        Les propositions et les enquêtes en cours, quartier par quartier, et les parkings de la ville.
      </p>
      <ExploreMap height={560} />
    </div>
  );
}
