// ══════════════════════════════════════════════════════════
// Middleware auth — le vigile de chaque route protégée
//
// Vérifie le JWT dans l'en-tête Authorization: Bearer <token>
// et injecte req.user = { userId, role, emailVerified }.
//
// Variantes exportées :
//   auth                 → 401 si pas connecté (ou compte supprimé)
//   optionalAuth         → identifie si possible, ne bloque jamais
//   isAdmin              → 403 si connecté mais pas ADMIN
//   requireVerifiedEmail → 403 si email non vérifié
//
// ── S5A-01 : pourquoi relire le compte en base ──────────────
// Le JWT est signé à la connexion et reste valide 7h. Si on lui
// faisait confiance pour le RÔLE, un admin rétrogradé (S5-19) —
// ou un compte supprimé — garderait tous ses droits jusqu'à
// l'expiration du jeton (OWASP A01, contrôle d'accès défaillant).
//
// Analogie : retirer le badge de quelqu'un dans le registre du
// personnel ne sert à rien si le lecteur de badge de la porte ne
// consulte jamais ce registre. Désormais, la porte consulte le
// registre à chaque passage.
//
// Coût : UNE lecture par clé primaire (index), qui remplace celle
// que requireVerifiedEmail faisait déjà de son côté — une route
// qui chaîne auth + requireVerifiedEmail fait donc autant de
// requêtes qu'avant. Le JWT prouve QUI tu es ; la base dit ce que
// tu as le DROIT de faire.
// ══════════════════════════════════════════════════════════

import { verifyToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';

/**
 * Retrouve le compte désigné par un JWT, avec ses droits ACTUELS.
 * @param {string} token
 * @returns {Promise<{ userId: string, role: string, emailVerified: boolean } | null>}
 *   null si le compte n'existe plus (supprimé depuis la connexion)
 * @throws {Error} si le jeton est invalide, expiré ou falsifié
 */
async function loadCurrentUser(token) {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, emailVerified: true },
  });
  if (!user) return null;
  // On ne garde du jeton que l'identité (userId) ; le rôle et la
  // vérification de l'email viennent de la base, jamais du jeton.
  return { userId: user.id, role: user.role, emailVerified: user.emailVerified };
}

/**
 * Exige un JWT valide ET un compte toujours existant. Injecte req.user.
 */
export async function auth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    const error = new Error('Authentification requise');
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    return next(error);
  }

  let currentUser;
  try {
    const token = header.slice(7); // enlève "Bearer "
    currentUser = await loadCurrentUser(token);
  } catch (err) {
    // Une erreur de BASE (Postgres injoignable…) n'est pas une
    // erreur d'authentification : on la laisse remonter telle
    // quelle (→ 500), sans faire croire au client que sa session
    // est expirée.
    if (!['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(err.name)) {
      return next(err);
    }
    const error = new Error(
      err.name === 'TokenExpiredError'
        ? 'Session expirée — reconnectez-vous'
        : 'Token invalide'
    );
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    return next(error);
  }

  if (!currentUser) {
    // Jeton authentique… pour un compte qui n'existe plus.
    const error = new Error('Ce compte n\'existe plus — reconnectez-vous');
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    return next(error);
  }

  // req.user est maintenant disponible dans tous les
  // contrôleurs et middlewares suivants de la chaîne
  req.user = currentUser;
  next();
}

/**
 * Identifie l'utilisateur SI un JWT valide est fourni — mais ne
 * bloque jamais, contrairement à auth(). req.user reste undefined
 * si personne n'est connecté, ou si le token est invalide/expiré
 * (on l'ignore silencieusement plutôt que de renvoyer une erreur).
 *
 * Utile pour une route publique qui se comporte "un peu différemment"
 * pour quelqu'un de connecté — ex. GET /proposals/:slug renvoie
 * l'agrégat des votes pour tout le monde, mais SI le visiteur est
 * connecté, on ajoute aussi "voici votre propre vote" à la réponse.
 *
 * Analogie : le videur habituel (auth) refuse l'entrée sans badge.
 * Celui-ci laisse entrer tout le monde, mais note discrètement qui
 * porte un badge valide, pour adapter l'accueil sans jamais recaler
 * personne à la porte.
 *
 * Usage : router.get('/:slug', optionalAuth, ctrl.getBySlug);
 */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(); // pas de token → visiteur anonyme, on continue
  }

  try {
    // Même relecture en base que auth() : sinon un admin rétrogradé
    // continuerait de voir les BROUILLONS via les routes publiques
    // (GET /proposals/:slug, /surveys/:slug), qui testent
    // req.user?.role === 'ADMIN'. Compte supprimé → null → anonyme.
    req.user = (await loadCurrentUser(header.slice(7))) || undefined;
  } catch (err) {
    if (!['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(err.name)) {
      return next(err); // vraie panne (base), pas un souci de session
    }
    // Token présent mais invalide/expiré : on l'ignore plutôt que
    // de bloquer une route publique pour un problème de session.
  }
  next();
}

/**
 * Exige le rôle ADMIN (à chaîner APRÈS auth).
 * req.user.role vient de la BASE (voir auth), pas du jeton : une
 * rétrogradation prend effet dès la requête suivante.
 * Usage : router.post('/...', auth, isAdmin, ctrl.create);
 */
export function isAdmin(req, _res, next) {
  if (req.user.role !== 'ADMIN') {
    const error = new Error('Accès réservé aux administrateurs');
    error.status = 403;
    error.code = 'FORBIDDEN';
    return next(error);
  }
  next();
}

/**
 * Exige un email vérifié (à chaîner APRÈS auth).
 *
 * Pourquoi ce n'est pas dans le JWT directement ? Le token est
 * signé à la connexion et reste valide 7h (JWT_EXPIRES_IN) — si
 * on y mettait emailVerified, un citoyen qui vérifie son email
 * APRÈS s'être connecté une première fois devrait se déconnecter/
 * reconnecter pour que ça se voie. En le relisant en BDD à chaque
 * requête (dans auth), l'information est toujours fraîche.
 *
 * Réutilisé partout où l'intégrité des résultats compte : voter,
 * commenter (Lot 2), répondre à une enquête (Sprint 4) — sans
 * email vérifié, un compte jetable pourrait gonfler les chiffres.
 *
 * Usage : router.put('/:id/vote', auth, requireVerifiedEmail, ctrl.castVote);
 */
export function requireVerifiedEmail(req, _res, next) {
  // Depuis S5A-01, auth() vient de relire le compte en base : l'info
  // est donc déjà fraîche dans req.user, inutile de refaire la même
  // requête. (Toujours chaîné APRÈS auth, jamais seul.)
  if (!req.user?.emailVerified) {
    const error = new Error(
      "Veuillez d'abord vérifier votre email pour participer — un lien vous a été envoyé à l'inscription"
    );
    error.status = 403;
    error.code = 'EMAIL_NOT_VERIFIED';
    return next(error);
  }

  next();
}
