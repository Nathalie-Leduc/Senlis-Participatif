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
      hash,
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
      hash,
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
