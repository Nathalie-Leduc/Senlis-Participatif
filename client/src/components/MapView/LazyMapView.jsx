// ══════════════════════════════════════════════════════════
// LazyMapView — point d'entrée public du composant carte
//
// Les pages important une carte doivent TOUJOURS passer par ce
// fichier, jamais par MapView.jsx directement. React.lazy() ne
// télécharge le code de MapView.jsx (et donc tout Leaflet) qu'au
// moment où ce composant est effectivement affiché à l'écran —
// pas au chargement initial du site, même pour un visiteur qui
// ne consultera jamais aucune carte.
//
// Analogie : c'est l'ascenseur qu'on appelle seulement quand on
// veut monter — pas un ascenseur qui tournerait en permanence
// "au cas où", même pour ceux qui prennent l'escalier.
// ══════════════════════════════════════════════════════════

import { lazy, Suspense } from 'react';

const MapView = lazy(() => import('./MapView.jsx'));

function MapFallback({ height = 320 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height, borderRadius: 20, background: '#E3EEF3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1E5F7C', fontWeight: 600, fontSize: 14,
      }}
    >
      🗺️ Chargement de la carte…
    </div>
  );
}

export default function LazyMapView(props) {
  return (
    <Suspense fallback={<MapFallback height={props.height} />}>
      <MapView {...props} />
    </Suspense>
  );
}
