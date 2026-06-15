// ══════════════════════════════════════════════════════════
// Hook useScrollReveal
//
// Déclenche une animation quand un élément devient visible
// dans le viewport (via IntersectionObserver). Utilisé pour
// les jauges de vote et les compteurs d'enquête.
//
// Usage :
//   const ref = useScrollReveal('animated', { threshold: 0.4 });
//   <div ref={ref} className="vote-bar">…</div>
//
// Accessibilité : si prefers-reduced-motion est activé,
// la classe est ajoutée immédiatement (pas d'animation).
// ══════════════════════════════════════════════════════════

import { useRef, useEffect } from 'react';

export default function useScrollReveal(className = 'animated', options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Si l'utilisateur préfère pas d'animation, on ajoute
    // la classe immédiatement (état final visible d'emblée)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      element.classList.add(className);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(className);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: options.threshold || 0.4, ...options }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [className, options]);

  return ref;
}
