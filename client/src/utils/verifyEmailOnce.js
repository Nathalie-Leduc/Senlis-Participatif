// ══════════════════════════════════════════════════════════
// Vérifier un email UNE seule fois par jeton (S5R-01)
//
// Bug de recette : en développement, React (mode StrictMode) exécute
// chaque useEffect DEUX fois. La page de vérification envoyait donc
// le jeton deux fois : le 1er envoi vérifiait l'adresse, le 2e
// recevait « jeton déjà utilisé »… et son erreur, arrivée en dernier,
// remplaçait l'écran de succès. L'adresse était vérifiée, mais la
// personne voyait « Oups ».
//
// La parade : garder en mémoire la PROMESSE de chaque jeton déjà
// envoyé. Un second appel pour le même jeton ne refait pas de requête :
// il reçoit exactement la même réponse que le premier.
//
// Analogie : la file d'attente d'un guichet. Si vous revenez avec le
// même ticket pendant qu'on traite votre demande, on ne rouvre pas un
// dossier : on vous donne la réponse du dossier en cours.
//
// (L'API est de toute façon devenue tolérante — un second envoi sur
// un compte vérifié répond « déjà vérifiée » — mais on évite la
// requête inutile.)
// ══════════════════════════════════════════════════════════

import { api } from '../services/api.js';

/** jeton → promesse de la réponse de l'API */
const inFlight = new Map();

/**
 * @param {string} token - le jeton reçu dans le lien de l'email
 * @returns {Promise<{ message: string, alreadyVerified?: boolean }>}
 */
export function verifyEmailOnce(token) {
  if (!inFlight.has(token)) {
    inFlight.set(token, api.post('/auth/verify-email', { token }));
  }
  return inFlight.get(token);
}

/** Pour les tests uniquement : oublier les jetons déjà envoyés. */
export function resetVerifyEmailOnce() {
  inFlight.clear();
}
