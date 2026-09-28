// ══════════════════════════════════════════════════════════
// Redirection après connexion : chemins INTERNES uniquement (S5A-08)
//
// ?redirect=/propositions/xxx ramène la personne là où elle était.
// Danger classique (OWASP : « open redirect ») : un lien piégé
// « …/connexion?redirect=//site-pirate.fr » qui, après une vraie
// connexion sur notre site, enverrait vers une fausse page imitant la
// nôtre (« session expirée, retapez votre mot de passe »).
//
// Pourquoi « commence par / » ne suffit pas : « //site-pirate.fr »
// commence bien par « / », mais le navigateur le lit comme une adresse
// COMPLÈTE sur un autre site (URL « protocole-relative »). Et « /\site »
// est corrigé en « //site » par les navigateurs.
//
// Analogie : le vestiaire accepte de vous raccompagner « à votre table »,
// jamais « à l'adresse notée sur ce papier » qu'on lui tend.
// ══════════════════════════════════════════════════════════

/**
 * @param {string|null} redirect - valeur brute du paramètre ?redirect=
 * @returns {string} un chemin interne sûr, ou '/' (accueil)
 *
 * @example
 * safeRedirectPath('/propositions/abc') // '/propositions/abc'
 * safeRedirectPath('//pirate.fr')       // '/'
 */
export function safeRedirectPath(redirect) {
  if (typeof redirect !== 'string') return '/';
  // Exactement UNE barre au début, suivie d'autre chose qu'une barre
  // ou une contre-barre
  if (!/^\/(?![/\\])/.test(redirect)) return '/';
  return redirect;
}
