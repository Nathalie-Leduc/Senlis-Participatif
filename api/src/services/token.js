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
import { Buffer } from 'node:buffer';
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
/**
 * Retrouve un jeton DÉJÀ consommé (ou invalidé), avec l'état actuel
 * de son compte — S5R-01.
 *
 * Sert à distinguer « ce lien n'a jamais existé / a été remplacé »
 * de « ce lien a DÉJÀ servi à vérifier ce compte » : un second clic
 * sur le lien de l'email (ou le double appel du mode StrictMode de
 * React en développement) ne doit pas afficher une erreur à quelqu'un
 * dont l'adresse est bel et bien vérifiée.
 *
 * @returns {Promise<{ userId: string, user: { emailVerified: boolean } } | null>}
 */
export async function findConsumedToken(plainToken, type) {
  const hash = crypto.createHash('sha256').update(plainToken).digest('hex');
  return prisma.authToken.findFirst({
    where: { tokenHash: hash, type, usedAt: { not: null } },
    select: { userId: true, user: { select: { emailVerified: true } } },
  });
}

// db (S5R-01) : client Prisma à utiliser — par défaut le client global,
// ou un client de TRANSACTION (tx) pour que la consommation du jeton
// et son effet (ex. « email vérifié ») soient enregistrés ensemble.
export async function verifyAndConsumeToken(plainToken, type, db = prisma) {
  const hash = crypto.createHash('sha256').update(plainToken).digest('hex');

  const token = await db.authToken.findFirst({
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
  await db.authToken.update({
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

/** Au bout de ce nombre d'essais ratés, le code est invalidé (S5A-06). */
export const MAX_TWO_FACTOR_ATTEMPTS = 5;

/**
 * Empreinte d'un code 2FA, LIÉE au compte (S5A-06).
 *
 * Pourquoi mélanger l'id du compte au code avant de hacher ? La
 * colonne tokenHash est UNIQUE. Un code à 6 chiffres n'a qu'un
 * million de valeurs : si deux admins recevaient par hasard le même
 * code au même moment, le second enregistrement serait refusé par la
 * base. Avec « userId:code », deux comptes ne produisent jamais la
 * même empreinte, même avec le même code.
 */
function hashTwoFactorCode(userId, code) {
  return crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

/**
 * Génère un code à 6 chiffres, le hashe et le stocke en BDD.
 * @param {string} userId
 * @returns {Promise<string>} Le code en clair (à envoyer par email)
 */
export async function createTwoFactorCode(userId) {
  // Un seul code actif à la fois : les précédents sont invalidés
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

  await prisma.authToken.create({
    data: {
      tokenHash: hashTwoFactorCode(userId, code),
      type: 'TWO_FACTOR_LOGIN',
      userId,
      expiresAt: new Date(Date.now() + TWO_FACTOR_TTL_MINUTES * 60 * 1000),
    },
  });

  return code;
}

/**
 * Vérifie le code 2FA d'un utilisateur.
 *
 * S5A-06 — nombre d'essais limité. Avant, seul le rate limiting par
 * adresse IP freinait un attaquant (qui connaîtrait déjà le mot de
 * passe) : en changeant d'IP, il pouvait essayer les codes à la
 * chaîne. Désormais, le code ACTIF du compte compte ses échecs ; au
 * 5e, il est détruit, et il faut repasser par le mot de passe pour en
 * recevoir un nouveau (par email, donc sous les yeux du titulaire).
 *
 * Analogie : la carte bancaire avalée après 3 codes faux — peu importe
 * depuis quel distributeur on essaie.
 *
 * Probabilité de deviner : 5 essais sur 1 000 000 de codes, soit
 * 1 chance sur 200 000 par email envoyé.
 *
 * @param {string} userId
 * @param {string} code
 * @throws {Error} INVALID_CODE (400), CODE_EXPIRED (400) ou TOO_MANY_ATTEMPTS (429)
 */
export async function verifyTwoFactorCode(userId, code) {
  // On cherche le code ACTIF du compte (il n'y en a qu'un, voir
  // createTwoFactorCode), puis on COMPARE — au lieu de chercher
  // directement par empreinte : sinon un code faux ne trouverait
  // aucune ligne, et on ne saurait pas à quel code compter l'échec.
  const token = await prisma.authToken.findFirst({
    where: { userId, type: 'TWO_FACTOR_LOGIN', usedAt: null },
    orderBy: { createdAt: 'desc' },
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

  // timingSafeEqual : comparaison en temps constant — le temps de
  // réponse ne trahit pas combien de caractères étaient justes.
  const expected = Buffer.from(token.tokenHash, 'hex');
  const received = Buffer.from(hashTwoFactorCode(userId, code), 'hex');
  const isValid = crypto.timingSafeEqual(expected, received);

  if (!isValid) {
    // increment ATOMIQUE, fait par PostgreSQL : deux essais envoyés
    // en même temps comptent bien pour deux (un « lire, ajouter 1,
    // réécrire » en JavaScript pourrait en perdre un).
    const updated = await prisma.authToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });

    if (updated.attempts >= MAX_TWO_FACTOR_ATTEMPTS) {
      await prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
      const error = new Error('Trop d\'essais — reconnectez-vous pour recevoir un nouveau code');
      error.status = 429;
      error.code = 'TOO_MANY_ATTEMPTS';
      throw error;
    }

    const remaining = MAX_TWO_FACTOR_ATTEMPTS - updated.attempts;
    const error = new Error(`Code incorrect — encore ${remaining} essai${remaining > 1 ? 's' : ''}`);
    error.status = 400;
    error.code = 'INVALID_CODE';
    throw error;
  }

  // Consommation CONDITIONNELLE : « marque ce code comme utilisé,
  // seulement s'il est encore actif ET sous la limite d'essais ».
  // Sans cette condition, une rafale de requêtes simultanées pourrait
  // toutes lire le code AVANT que les échecs soient comptés, et la
  // bonne réponse passerait même après 5 échecs. updateMany renvoie
  // le nombre de lignes modifiées : 0 = quelqu'un est passé avant.
  const { count } = await prisma.authToken.updateMany({
    where: { id: token.id, usedAt: null, attempts: { lt: MAX_TWO_FACTOR_ATTEMPTS } },
    data: { usedAt: new Date() },
  });
  if (count === 0) {
    const error = new Error('Trop d\'essais — reconnectez-vous pour recevoir un nouveau code');
    error.status = 429;
    error.code = 'TOO_MANY_ATTEMPTS';
    throw error;
  }
}
