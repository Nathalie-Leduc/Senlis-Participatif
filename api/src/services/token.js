// ══════════════════════════════════════════════════════════
// Service Token — jetons email & reset password
//
// On ne stocke JAMAIS le jeton en clair en BDD. On stocke
// son hash (SHA-256). Quand l'utilisateur clique le lien,
// on rehashe le jeton reçu et on compare.
//
// Analogie : c'est comme une consigne à la gare. Tu reçois
// un ticket (le jeton en clair dans l'email). La consigne
// garde une empreinte du ticket (le hash en BDD). Quand tu
// reviens, elle compare — mais si quelqu'un pirate la base,
// il ne voit que les empreintes, pas les tickets.
// ══════════════════════════════════════════════════════════

import crypto from 'crypto';
import prisma from '../lib/prisma.js';

const TOKEN_TTL_MINUTES = parseInt(process.env.TOKEN_TTL_MINUTES || '60', 10);

/**
 * Génère un jeton aléatoire, le hashe et le stocke en BDD.
 * @param {string} userId - ID de l'utilisateur
 * @param {'VERIFY_EMAIL' | 'RESET_PASSWORD'} type
 * @returns {string} Le jeton en clair (à envoyer par email)
 */
export async function createToken(userId, type) {
  // Invalide les anciens jetons du même type pour cet utilisateur
  // (on ne veut pas 10 jetons de reset empilés)
  await prisma.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() }, // marque comme "utilisé" = invalidé
  });

  // Génère 32 octets aléatoires → 64 caractères hex
  const plainToken = crypto.randomBytes(32).toString('hex');

  // Hash SHA-256 du jeton (ce qu'on stocke en BDD)
  const hash = crypto.createHash('sha256').update(plainToken).digest('hex');

  // Stocke en BDD avec expiration
  await prisma.authToken.create({
    data: {
      tokenHash: hash, // ← Prisma attend "tokenHash", pas "hash"
      type,
      userId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    },
  });

  return plainToken;
}

/**
 * Vérifie un jeton : le rehashe, cherche en BDD, vérifie
 * qu'il n'est ni expiré ni déjà utilisé.
 * @param {string} plainToken - Le jeton reçu de l'utilisateur
 * @param {'VERIFY_EMAIL' | 'RESET_PASSWORD'} type
 * @returns {object} Le record AuthToken (avec userId)
 * @throws {Error} Si le jeton est invalide, expiré ou déjà utilisé
 */
export async function verifyAndConsumeToken(plainToken, type) {
  const hash = crypto.createHash('sha256').update(plainToken).digest('hex');

  const token = await prisma.authToken.findFirst({
    where: {
      tokenHash: hash,   // ← Prisma attend "tokenHash", pas "hash"
      type,
      usedAt: null, // pas encore utilisé
    },
  });

  if (!token) {
    const error = new Error('Jeton invalide ou déjà utilisé');
    error.status = 400;
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  if (token.expiresAt < new Date()) {
    const error = new Error('Ce jeton a expiré — veuillez en demander un nouveau');
    error.status = 400;
    error.code = 'TOKEN_EXPIRED';
    throw error;
  }

  // Marque le jeton comme utilisé (usage unique)
  await prisma.authToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  return token;
}

// ── Code 2FA (connexion admin) ──────────────────────────
//
// Distinct de createToken/verifyAndConsumeToken ci-dessus : ceux-là
// génèrent un jeton de 64 caractères hex, pensé pour un LIEN cliqué
// (email de vérification, reset password) — imbuvable à taper à la
// main. Un code 2FA doit au contraire être court : on demande à la
// personne de le RECOPIER depuis son email vers le formulaire.
//
// Même table AuthToken (type: TWO_FACTOR_LOGIN), même principe de
// hash — seul le FORMAT du secret change (6 chiffres vs 64 hex).
const TWO_FACTOR_TTL_MINUTES = parseInt(process.env.TWO_FACTOR_TTL_MINUTES || '10', 10);

/**
 * Génère un code à 6 chiffres, le hashe et le stocke en BDD.
 * @param {string} userId
 * @returns {Promise<string>} Le code en clair (à envoyer par email)
 */
export async function createTwoFactorCode(userId) {
  await prisma.authToken.updateMany({
    where: { userId, type: 'TWO_FACTOR_LOGIN', usedAt: null },
    data: { usedAt: new Date() },
  });

  // randomInt (pas Math.random) : générateur cryptographiquement
  // sûr, indispensable pour un secret de sécurité même court.
  // padStart(6, '0') : un nombre tiré au sort peut commencer par un
  // zéro (ex. 042871) — sans padding, ce serait "42871" (5 chiffres)
  // et la comparaison avec le code affiché à l'écran échouerait.
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const hash = crypto.createHash('sha256').update(code).digest('hex');

  await prisma.authToken.create({
    data: {
      tokenHash: hash,
      type: 'TWO_FACTOR_LOGIN',
      userId,
      expiresAt: new Date(Date.now() + TWO_FACTOR_TTL_MINUTES * 60 * 1000),
    },
  });

  return code;
}

/**
 * Vérifie un code 2FA pour un utilisateur donné.
 *
 * Contrairement à verifyAndConsumeToken (qui retrouve le jeton par
 * son seul hash, effectivement unique sur 64 caractères hex), on a
 * IMPÉRATIVEMENT besoin de userId ici : un code à 6 chiffres a
 * "seulement" un million de valeurs possibles — sans le restreindre
 * au bon compte, deux admins pourraient un jour recevoir le même
 * code par coïncidence, et une recherche par hash seul risquerait
 * de retomber sur le mauvais utilisateur.
 *
 * @param {string} userId
 * @param {string} code
 * @throws {Error} Si le code est invalide, expiré ou déjà utilisé
 */
export async function verifyTwoFactorCode(userId, code) {
  const hash = crypto.createHash('sha256').update(code).digest('hex');

  const token = await prisma.authToken.findFirst({
    where: { userId, tokenHash: hash, type: 'TWO_FACTOR_LOGIN', usedAt: null },
  });

  if (!token) {
    const error = new Error('Code invalide ou déjà utilisé');
    error.status = 400;
    error.code = 'INVALID_CODE';
    throw error;
  }

  if (token.expiresAt < new Date()) {
    const error = new Error('Ce code a expiré — reconnectez-vous pour en recevoir un nouveau');
    error.status = 400;
    error.code = 'CODE_EXPIRED';
    throw error;
  }

  await prisma.authToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });
}
