// ══════════════════════════════════════════════════════════
// Limite d'essais de connexion PAR COMPTE (S5R-13b)
//
// 10 mots de passe faux en une heure pour une même adresse email, et
// la connexion à ce compte est suspendue jusqu'à la fin de l'heure —
// même avec le BON mot de passe (sinon l'attaquant saurait qu'il a
// trouvé). Au 10e échec, le titulaire reçoit un email d'alerte.
//
// Pourquoi, en plus de la limite par adresse IP ? Celle-ci freine un
// ordinateur ; un attaquant qui en utilise des centaines (réseau de
// machines piratées) y échappe. La limite par compte, elle, protège
// le compte visé, d'où que viennent les essais. C'est elle qui place
// le site dans le « cas n° 2 » de la CNIL (§ 43 : 10 essais par heure),
// où 15 caractères sans règle de composition suffisent largement.
//
// Analogie : le coffre-fort qui se bloque une heure après dix
// combinaisons fausses — peu importe qui les a composées.
//
// Les adresses inconnues sont comptées de la même façon : sinon, le
// blocage au 11e essai révélerait quelles adresses ont un compte.
// Les compteurs de plus d'une heure sont effacés chaque nuit
// (services/retention.js, purgeExpiredThrottles).
// ══════════════════════════════════════════════════════════

import { createHmac } from 'node:crypto';
import prisma from '../lib/prisma.js';

export const MAX_FAILURES = 10;
export const WINDOW_MS = 60 * 60 * 1000; // une heure

/**
 * L'adresse n'est jamais stockée en clair : on garde son empreinte
 * HMAC, calculée avec la clé secrète du serveur. Sans cette clé, on
 * ne peut pas retrouver les adresses en essayant une liste d'emails
 * connus (ce que permettrait une simple empreinte SHA-256).
 */
export function throttleKey(email) {
  const secret = process.env.JWT_SECRET || 'cle-de-developpement';
  return createHmac('sha256', secret).update(String(email).trim().toLowerCase()).digest('hex');
}

/** Minutes restantes avant la fin de la fenêtre (au moins 1) */
const minutesLeft = (windowStart, now) =>
  Math.max(1, Math.ceil((windowStart.getTime() + WINDOW_MS - now) / 60000));

/**
 * Refuse la tentative si le compte a déjà atteint 10 échecs dans
 * l'heure. À appeler AVANT de vérifier le mot de passe.
 *
 * @throws {Error} 429 ACCOUNT_THROTTLED
 */
export async function assertLoginAllowed(email, now = Date.now()) {
  const row = await prisma.loginThrottle.findUnique({ where: { key: throttleKey(email) } });
  if (!row || row.failures < MAX_FAILURES) return;
  if (row.windowStart.getTime() + WINDOW_MS <= now) return; // l'heure est passée

  const minutes = minutesLeft(row.windowStart, now);
  const error = new Error(
    `Trop d'essais de connexion pour ce compte — réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}, `
    + 'ou choisissez un nouveau mot de passe avec « Mot de passe oublié ».',
  );
  error.status = 429;
  error.code = 'ACCOUNT_THROTTLED';
  throw error;
}

/**
 * Note un échec et renvoie le nombre d'échecs de la fenêtre en cours.
 *
 * Une seule requête SQL, atomique : deux essais simultanés ne peuvent
 * pas lire le même compteur et écrire chacun « 1 de plus ». Si la
 * fenêtre précédente est terminée, le compteur repart à 1.
 *
 * @returns {Promise<number>}
 */
export async function recordLoginFailure(email, now = new Date()) {
  const windowEnd = new Date(now.getTime() - WINDOW_MS);
  const rows = await prisma.$queryRaw`
    INSERT INTO "LoginThrottle" ("key", "failures", "windowStart")
    VALUES (${throttleKey(email)}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "failures"    = CASE WHEN "LoginThrottle"."windowStart" <= ${windowEnd} THEN 1 ELSE "LoginThrottle"."failures" + 1 END,
      "windowStart" = CASE WHEN "LoginThrottle"."windowStart" <= ${windowEnd} THEN ${now} ELSE "LoginThrottle"."windowStart" END
    RETURNING "failures"`;
  return rows[0].failures;
}

/** Connexion réussie ou mot de passe réinitialisé : le compteur repart de zéro */
export async function clearLoginFailures(email) {
  await prisma.loginThrottle.deleteMany({ where: { key: throttleKey(email) } });
}
