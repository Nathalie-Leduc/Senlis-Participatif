// ══════════════════════════════════════════════════════════
// Page 404 — le cerf perdu dans la forêt (S5R2-10, extrait de S7-05)
//
// La page d'erreur est souvent la PREMIÈRE vue par quelqu'un qui suit
// un lien cassé (un vieux partage sur les réseaux, une affiche avec une
// faute de frappe). Elle doit donc :
//  - rassurer, sans culpabiliser (charte § 7 : « le cerf a l'air
//    perplexe, pas de message culpabilisant ») ;
//  - dire quelle adresse ne mène nulle part (souvent, on voit la faute) ;
//  - proposer tout de suite les chemins utiles : un panneau indicateur
//    vers l'accueil, les propositions, les enquêtes, la carte ;
//  - ne pas être indexée par les moteurs de recherche (balise robots
//    « noindex ») : le site est une application d'une seule page, le
//    serveur répond toujours « 200 OK », Google ne peut pas deviner
//    seul que cette page est une erreur.
//
// Analogie : le panneau « Vous êtes ici » d'un sentier forestier —
// on s'est égaré, mais on voit tout de suite où aller.
// ══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Mascot from '../components/Mascot/Mascot.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';

// Les directions du panneau : les pages qu'on vient le plus souvent chercher
export const SIGNPOST = [
  { to: '/', label: 'Accueil', icon: '🏠' },
  { to: '/propositions', label: 'Propositions', icon: '💡' },
  { to: '/enquetes', label: 'Enquêtes', icon: '📋' },
  { to: '/carte', label: 'Carte', icon: '🗺️' },
];

/**
 * Pendant que la page est affichée : « moteurs de recherche, n'indexez
 * pas ». Retirée en quittant la page (les autres pages restent indexables).
 */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

/** Un sapin stylisé (trois étages), pour le décor de la forêt */
function Pine({ x, scale = 1, shade = '#3A7A4D' }) {
  return (
    <g transform={`translate(${x} ${170 - 120 * scale}) scale(${scale})`}>
      <rect x="-5" y="100" width="10" height="20" rx="2" fill="#8B6914" />
      <path d="M0 0 L32 46 L-32 46 Z" fill={shade} />
      <path d="M0 26 L40 76 L-40 76 Z" fill={shade} />
      <path d="M0 54 L48 104 L-48 104 Z" fill={shade} />
    </g>
  );
}

export default function NotFound() {
  usePageTitle('Page introuvable');
  useNoIndex();
  const { pathname } = useLocation();

  return (
    <div className="wrap lost-page">
      {/* La forêt : décor seulement (aria-hidden), le sens est dans le texte */}
      <div className="lost-forest">
        {/* La bulle du cerf, au-dessus de la scène (et non sur ses bois,
            comme ailleurs) : ici, rien ne doit la couper ni cacher le « ? » */}
        <p className="speech-bubble lost-bubble">Oups, je me suis perdu dans la forêt…</p>
        <svg className="lost-trees" viewBox="0 0 600 180" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMax meet">
          <ellipse cx="300" cy="172" rx="300" ry="14" fill="#E0F2E5" />
          <Pine x={40} scale={0.85} shade="#4C8A5C" />
          <Pine x={110} scale={1.1} />
          <Pine x={175} scale={0.7} shade="#4C8A5C" />
          <Pine x={425} scale={0.75} shade="#4C8A5C" />
          <Pine x={490} scale={1.15} />
          <Pine x={560} scale={0.8} shade="#4C8A5C" />
        </svg>
        <div className="lost-mascot">
          <Mascot size="hero" mood="perplexe" />
        </div>
      </div>

      <h1 className="lost-title">Page introuvable</h1>
      <p className="lost-text">
        L'adresse <code className="lost-path">{pathname}</code> ne mène nulle part : la page a pu être
        déplacée, ou le lien contient une petite faute. Retrouvons le chemin ensemble !
      </p>

      {/* Le panneau indicateur */}
      <nav className="lost-signpost" aria-label="Retrouver son chemin">
        <ul>
          {SIGNPOST.map((sign) => (
            <li key={sign.to}>
              <Link to={sign.to} className={sign.to === '/' ? 'btn btn-primary' : 'btn lost-sign'}>
                <span aria-hidden="true">{sign.icon} </span>{sign.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
