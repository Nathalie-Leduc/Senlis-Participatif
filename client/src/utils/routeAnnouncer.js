// ══════════════════════════════════════════════════════════
// Annonce des changements de page (S5A-07 — RGAA 7.5 et 12.x)
//
// Dans une application React (SPA), changer de page ne recharge pas
// le navigateur : pour un lecteur d'écran, rien ne se passe. La
// personne clique sur « Enquêtes »… et reste dans le silence, le
// focus perdu sur un lien qui n'existe plus.
//
// À chaque nouvelle page, on fait donc ce qu'un vrai chargement de
// page ferait :
//  1. annoncer son titre dans une zone « aria-live » (lue à voix haute) ;
//  2. placer le focus sur son titre principal <h1> — la touche Tab
//     repart alors du haut du nouveau contenu, pas du lien cliqué.
//
// Analogie : l'annonce « Prochain arrêt : Senlis » dans le bus. Sans
// elle, on voit la ville défiler par la fenêtre… sauf si on ne la
// voit pas.
//
// Au tout premier chargement, on n'annonce rien : le navigateur lit
// déjà la page lui-même.
// ══════════════════════════════════════════════════════════

export const ANNOUNCER_ID = 'route-announcer';

let lastPath = null;

/**
 * À appeler quand une page vient de s'afficher (usePageTitle le fait).
 * N'agit que si le chemin a changé depuis la dernière annonce : une
 * même page qui met à jour son titre (chargement → titre réel) n'est
 * pas annoncée deux fois.
 *
 * @param {string} pathname - chemin de la page (location.pathname)
 * @param {string} title - titre complet de l'onglet
 */
export function announcePageChange(pathname, title) {
  if (pathname === lastPath) return;
  const isFirstPage = lastPath === null;
  lastPath = pathname;
  if (isFirstPage) return;

  const region = document.getElementById(ANNOUNCER_ID);
  if (region) region.textContent = `Page chargée : ${title}`;

  // Le <h1> de la page, ou à défaut la zone principale
  const main = document.getElementById('main');
  const target = main?.querySelector('h1') || main;
  if (target) {
    // tabIndex -1 : focusable par le code, mais pas ajouté à l'ordre
    // de tabulation (un titre n'est pas un bouton).
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
  }
}

/** Pour les tests uniquement : repartir comme au premier chargement. */
export function resetRouteAnnouncer() {
  lastPath = null;
}
