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

import { lazy, Suspense, useEffect, useRef, useState } from 'react';

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

/**
 * S5R2-08 partie 3 (Lighthouse) : vrai tant que l'élément n'est pas
 * arrivé à moins de 300 px de l'écran. Sur l'accueil, la carte est loin
 * sous la ligne de flottaison : Leaflet (≈ 46 Ko compressés et 200 ms de
 * calcul sur un téléphone moyen) se chargeait pourtant dès l'arrivée,
 * en concurrence avec ce que la personne voit d'abord.
 * Sans IntersectionObserver (vieux navigateur, tests) : chargée tout de suite.
 * Analogie : l'ascenseur n'est plus appelé quand on entre dans
 * l'immeuble, mais quand on approche de sa porte.
 */
function useNearViewport() {
  const ref = useRef(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (near || !ref.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near];
}

export default function LazyMapView(props) {
  const [ref, near] = useNearViewport();
  if (!near) {
    // Même encombrement que la carte : rien ne bouge quand elle arrive
    return <div ref={ref}><MapFallback height={props.height} /></div>;
  }
  return (
    <Suspense fallback={<MapFallback height={props.height} />}>
      <MapView {...props} />
    </Suspense>
  );
}
