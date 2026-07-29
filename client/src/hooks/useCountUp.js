// ══════════════════════════════════════════════════════════
// Hook useCountUp — anime un nombre de 0 jusqu'à `target`, une
// fois `start` passé à true (typiquement piloté par useIsVisible).
//
// requestAnimationFrame plutôt que setInterval : la fréquence
// s'aligne sur le taux de rafraîchissement réel de l'écran, pas
// sur un intervalle arbitraire qui saccaderait sur certains
// appareils.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';

export default function useCountUp(target, { duration = 1200, start = false } = {}) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start || startedRef.current) return undefined;
    startedRef.current = true;

    // Personne ne devrait avoir à SUBIR une animation qu'iel a
    // explicitement demandé d'éviter — le nombre final s'affiche
    // directement, sans étape intermédiaire.
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValue(target);
      return undefined;
    }

    const startTime = performance.now();
    let frameId;

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutCubic : démarre vite, ralentit en fin de course — plus
      // agréable à l'œil qu'une progression strictement linéaire.
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(eased * target));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [start, target, duration]);

  return value;
}
