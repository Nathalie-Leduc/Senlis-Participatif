// ══════════════════════════════════════════════════════════
// Hook useIsVisible — expose un booléen "visible", contrairement à
// useScrollReveal (qui pose directement une classe CSS sur le DOM
// sans jamais l'exposer à React). Un compteur qui s'anime a besoin
// de DÉCLENCHER un effet React (démarrer le compte), pas juste de
// recevoir une classe CSS — d'où ce hook à part plutôt que de
// modifier useScrollReveal et risquer de casser ses usages actuels
// (ProposalCard.jsx, qui attend un ref brut en retour).
// ══════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';

export default function useIsVisible(options = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const threshold = options.threshold ?? 0.4;

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isVisible];
}
