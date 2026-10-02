// ══════════════════════════════════════════════════════════
// Limiteur des routes d'authentification (correctif de recette)
//
// Bug constaté le 02/10/2026 : après une série de tests, la connexion
// admin affichait « Erreur réseau » alors que les emails partaient.
// Ce n'était PAS le réseau : l'API répondait 429 « Trop de requêtes ».
// Deux défauts se cumulaient :
//
//  1. la réponse 429 était du TEXTE brut (message par défaut de
//     express-rate-limit), alors que le client attend du JSON — ne
//     pouvant pas le lire, il affichait son message de secours,
//     « Erreur réseau inattendue » ;
//  2. TOUTES les requêtes comptaient, y compris les connexions
//     RÉUSSIES. Une connexion admin en consomme 2 (mot de passe + code)
//     et 7 routes partagent le même compteur : 10 « essais » en 15 min
//     s'épuisaient en utilisation normale.
//
// Correctifs :
//  - réponse JSON standard { error: { code: 'RATE_LIMITED', message } },
//    avec le délai d'attente réel ;
//  - skipSuccessfulRequests : seules les requêtes en ÉCHEC (statut
//    ≥ 400) comptent. C'est bien la force brute qu'on veut freiner, pas
//    les personnes qui se connectent correctement ;
//  - en développement, une limite plus large (100) : tester un parcours
//    de connexion ne doit pas bloquer la développeuse un quart d'heure.
//    En production, elle reste à 10 échecs par quart d'heure et par IP.
//
// Analogie : le videur ne compte plus les gens qui entrent avec un
// billet valable — seulement ceux qu'il a dû refouler.
// ══════════════════════════════════════════════════════════

import rateLimit from 'express-rate-limit';

/** Échecs autorisés par fenêtre, selon l'environnement. */
function defaultMax() {
  if (process.env.NODE_ENV === 'test') return 1000;
  if (process.env.NODE_ENV === 'production') return 10;
  return 100; // développement
}

/**
 * @param {{ windowMs?: number, max?: number }} [options] - pour les tests
 */
export function createAuthLimiter({ windowMs = 15 * 60 * 1000, max = defaultMax() } = {}) {
  return rateLimit({
    windowMs,
    max,
    // N'augmente le compteur que pour les réponses en échec (4xx, 5xx)
    skipSuccessfulRequests: true,
    // En-têtes RateLimit-* standard : le client peut savoir combien
    // d'essais il reste, et quand la fenêtre se termine
    standardHeaders: true,
    legacyHeaders: false,
    // handler plutôt que message : on calcule le délai restant exact
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const minutes = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000)) : 15;
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Trop de tentatives — réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
        },
      });
    },
  });
}
