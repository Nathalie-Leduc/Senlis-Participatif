// ══════════════════════════════════════════════════════════
// Titre de l'onglet, propre à chaque page (S5A-07 — RGAA 8.6)
//
// Avant : toutes les pages s'appelaient « Senlis Participatif ». Avec
// dix onglets ouverts, ou pour un lecteur d'écran qui annonce le titre
// en premier, impossible de savoir où l'on est.
//
// Usage, TOUT EN HAUT du composant de page (avant tout return) :
//   usePageTitle('Propositions');
//   usePageTitle(proposal?.title ?? 'Proposition'); // titre dynamique
// → « Propositions — Senlis Participatif »
//
// Le hook déclenche aussi l'annonce du changement de page aux
// lecteurs d'écran (voir utils/routeAnnouncer.js) : c'est au moment
// où la page pose son titre qu'on sait qu'elle est vraiment affichée.
// ══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE } from '../constants/legal.js';
import { announcePageChange } from '../utils/routeAnnouncer.js';

/** « Titre — Senlis Participatif », ou le nom du site seul. */
export function formatPageTitle(title) {
  return title ? `${title} — ${SITE.name}` : SITE.name;
}

/**
 * @param {string} title - titre de la page, sans le nom du site
 */
export function usePageTitle(title) {
  const { pathname } = useLocation();

  useEffect(() => {
    const full = formatPageTitle(title);
    document.title = full;
    announcePageChange(pathname, full);
  }, [title, pathname]);
}
