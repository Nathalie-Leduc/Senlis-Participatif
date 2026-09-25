// ══════════════════════════════════════════════════════════
// JWT — génération et vérification des tokens d'accès
//
// Analogie : le JWT c'est un bracelet de festival. Quand tu
// t'inscris (register → login), on te donne un bracelet
// signé. À chaque entrée de zone VIP (route protégée), le
// vigile (middleware auth) vérifie le bracelet. Il n'a pas
// besoin de rappeler l'accueil : le bracelet porte toutes
// les infos (userId, role) et la signature prouve qu'il
// est authentique. C'est le "stateless" de JWT.
// ══════════════════════════════════════════════════════════

import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7h';

if (!SECRET) {
  throw new Error('JWT_SECRET manquant dans .env — impossible de signer les tokens');
}

// ── Algorithme épinglé (S5A-01 — OWASP A02/A07) ──────────
// Un JWT annonce lui-même, dans son en-tête, l'algorithme avec
// lequel il prétend avoir été signé. Sans liste blanche, c'est le
// JETON qui choisit comment on le vérifie — la porte ouverte aux
// attaques de « confusion d'algorithme » (alg: none, ou RS256 vs
// HS256). On signe et on vérifie donc TOUJOURS en HS256, et rien
// d'autre n'est accepté.
//
// Analogie : le vigile ne demande pas au visiteur « avec quel
// tampon votre bracelet a-t-il été validé ? » — il ne connaît
// qu'un seul tampon, le sien.
const ALGORITHM = 'HS256';
const SIGN_OPTIONS = { algorithm: ALGORITHM };
const VERIFY_OPTIONS = { algorithms: [ALGORITHM] };

/**
 * Crée un JWT contenant l'id et le rôle de l'utilisateur.
 *
 * ⚠️ Le rôle inscrit ici n'est qu'une INDICATION (utile au client
 * pour décoder le jeton). Depuis S5A-01, le serveur ne lui fait plus
 * confiance : le middleware auth relit le rôle en base à chaque
 * requête — voir middlewares/auth.js.
 * @param {{ id: string, role: string }} user
 * @returns {string} Token signé
 */
export function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    SECRET,
    { ...SIGN_OPTIONS, expiresIn: EXPIRES_IN }
  );
}

/**
 * Vérifie et décode un JWT.
 * @param {string} token
 * @returns {{ userId: string, role: string }} Payload décodé
 * @throws {Error} Si le token est invalide, expiré ou falsifié
 */
export function verifyToken(token) {
  const payload = jwt.verify(token, SECRET, VERIFY_OPTIONS);

  // Un jeton de défi 2FA (voir signTwoFactorChallenge) porte un
  // "purpose" — un vrai jeton de session n'en a jamais. Le refuser
  // ici évite qu'un jeton de défi intercepté serve à autre chose
  // qu'à passer /auth/2fa/verify, même s'il est structurellement
  // un JWT valide signé avec le même secret.
  if (payload.purpose) {
    const error = new Error('Token invalide');
    error.name = 'JsonWebTokenError';
    throw error;
  }

  return payload;
}

// ── Jeton de défi 2FA ────────────────────────────────────
//
// Émis juste après un mot de passe correct pour un compte admin,
// avant que la connexion soit complète — le temps que le code reçu
// par email soit saisi. Volontairement TRÈS court (10 min, contre
// 7h pour une session normale) et dépourvu du rôle : un jeton de
// défi qui fuiterait ne permettrait ni de rester connecté ni
// d'agir en admin, juste de tenter le code — que verifyTwoFactorCode
// limite déjà par ailleurs (jeton à usage unique, lié à cet userId).
const TWO_FACTOR_CHALLENGE_TTL = '10m';

/**
 * @param {{ id: string }} user
 * @returns {string} Jeton de défi signé
 */
export function signTwoFactorChallenge(user) {
  return jwt.sign(
    { userId: user.id, purpose: 'PENDING_2FA' },
    SECRET,
    { ...SIGN_OPTIONS, expiresIn: TWO_FACTOR_CHALLENGE_TTL },
  );
}

/**
 * @param {string} token
 * @returns {{ userId: string }}
 * @throws {Error} Si le jeton est invalide, expiré, ou n'est pas un jeton de défi 2FA
 */
export function verifyTwoFactorChallenge(token) {
  const payload = jwt.verify(token, SECRET, VERIFY_OPTIONS);

  if (payload.purpose !== 'PENDING_2FA') {
    const error = new Error('Jeton de vérification invalide');
    error.status = 401;
    error.code = 'INVALID_CHALLENGE';
    throw error;
  }

  return payload;
}

// ── Jeton "appareil de confiance" (2FA) ──────────────────
//
// Émis juste après un code 2FA correct, en plus du vrai jeton de
// session — pas à la place. But : sur CE navigateur précis, ne plus
// redemander de code pendant sa durée de vie, sans pour autant
// prolonger la fenêtre où un JWT volé permettrait de se faire passer
// pour un admin (ce jeton ne fait QUE dispenser du défi email à la
// prochaine connexion, il ne donne accès à rien par lui-même — voir
// son usage dans login(), jamais dans le middleware auth).
// Durée volontairement courte et configurable (1h par défaut) :
// c'est un compromis confort/sécurité, pas une "confiance" acquise
// pour de bon.
const TRUSTED_DEVICE_TTL = process.env.TRUSTED_DEVICE_TTL || '1h';

/**
 * @param {{ id: string }} user
 * @returns {string} Jeton "appareil de confiance" signé
 */
export function signTrustedDeviceToken(user) {
  return jwt.sign(
    { userId: user.id, purpose: 'TRUSTED_DEVICE' },
    SECRET,
    { ...SIGN_OPTIONS, expiresIn: TRUSTED_DEVICE_TTL },
  );
}

/**
 * @param {string} token
 * @returns {{ userId: string }}
 * @throws {Error} Si le jeton est invalide, expiré, ou n'est pas un jeton "appareil de confiance"
 */
export function verifyTrustedDeviceToken(token) {
  const payload = jwt.verify(token, SECRET, VERIFY_OPTIONS);

  if (payload.purpose !== 'TRUSTED_DEVICE') {
    const error = new Error('Jeton invalide');
    error.name = 'JsonWebTokenError';
    throw error;
  }

  return payload;
}
