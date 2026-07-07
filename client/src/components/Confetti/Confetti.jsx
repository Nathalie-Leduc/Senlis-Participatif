// ══════════════════════════════════════════════════════════
// Confetti — petite pluie de confettis, déclenchée après un vote
//
// Usage : <Confetti trigger={burstCount} />
// Le parent incrémente "burstCount" à chaque vote réussi — c'est
// ce changement de valeur qui relance l'animation (même si on
// revote la même valeur juste après).
//
// Respecte prefers-reduced-motion : dans ce cas, AUCUN confetti
// n'apparaît, plutôt qu'une version "allégée". Un vote est déjà
// confirmé par le toast texte juste à côté — les confettis ne
// sont qu'une couche de joie en plus, jamais une information
// nécessaire pour comprendre ce qui vient de se passer.
//
// Analogie : le confetti, c'est l'applaudissement après un vote —
// agréable, mais jamais indispensable pour savoir que le vote a
// été pris en compte.
// ══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

const COLORS = ['#1E5F7C', '#3A7A4D', '#D4A84A', '#A8442F', '#F0C45A'];
const PIECE_COUNT = 24;
const DURATION_MS = 1800;

export default function Confetti({ trigger }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    // trigger vaut 0 (ou undefined) avant le premier vote — on ne
    // déclenche rien au montage du composant, seulement sur un
    // vrai changement causé par un vote.
    if (!trigger) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const newPieces = Array.from({ length: PIECE_COUNT }, (_, i) => ({
      id: `${trigger}-${i}`,
      left: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.3,
      duration: 1.2 + Math.random() * 0.6,
    }));
    setPieces(newPieces);

    const timeout = setTimeout(() => setPieces([]), DURATION_MS);
    return () => clearTimeout(timeout);
  }, [trigger]);

  if (pieces.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, overflow: 'hidden' }}
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
