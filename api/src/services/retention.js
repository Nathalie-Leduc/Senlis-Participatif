// ══════════════════════════════════════════════════════════
// Durées de conservation — purge automatique (S5A-05)
//
// Le RGPD (art. 5.1.e) interdit de garder des données « plus
// longtemps que nécessaire ». La politique de confidentialité promet
// deux choses, que ce fichier TIENT :
//
//  1. Jetons à usage unique (liens email, codes 2FA) : effacés une
//     fois expirés ou utilisés (après 24 h de marge, utile au debug).
//  2. Comptes citoyens sans connexion depuis 3 ans : DEUX emails
//     d'avertissement — le premier 30 jours avant, le second (« dernier
//     rappel », S5R2-09) 7 jours avant — puis suppression si la
//     personne ne s'est toujours pas reconnectée.
//  3. Journal des actions d'administration (S5A-06) : 6 mois, durée
//     recommandée par la CNIL pour des journaux de traçabilité.
//  4. Compteurs d'essais de connexion (S5R-13b) : une heure ; ceux
//     dont l'heure est passée sont effacés à chaque passage.
//
// Analogie : la bibliothèque qui envoie « votre carte d'adhérent
// expire, passez nous voir » avant de radier le lecteur — jamais
// l'inverse, et jamais sans prévenir.
//
// Garde-fous :
//  - les comptes ADMIN et EDITOR (Admin-test, S5R2-11) ne sont JAMAIS
//    supprimés automatiquement (seul le rôle CITIZEN est purgé)
//    (perdre le dernier admin bloquerait toute la plateforme) ;
//  - pas d'avertissement parti (échec SMTP) → pas de suppression :
//    on ne supprime jamais un compte dont le titulaire n'a pas pu
//    être prévenu DEUX fois ; l'envoi sera retenté au passage suivant ;
//  - toujours au moins 7 jours entre le dernier rappel et la
//    suppression : si ce rappel part en retard (échecs d'envoi
//    répétés), la suppression est repoussée d'autant ;
//  - le journal d'administration survit à la suppression d'un compte
//    (actorId → null, pseudo conservé) : ce n'est pas un doublon, c'est
//    la trace de ce que ce compte a fait quand il était admin ;
//  - toutes les fonctions reçoivent `now` en paramètre : les tests
//    peuvent « voyager dans le temps » sans attendre 3 ans.
//
// Lancé par scripts/purge.js (npm run purge), une fois par jour en
// production (tâche planifiée Clever Cloud, S5-22).
// ══════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';
import { sendInactivityWarning } from './email.js';
import { WINDOW_MS } from './loginThrottle.js';

export const INACTIVITY_YEARS = 3;
export const WARNING_NOTICE_DAYS = 30;
// S5R2-09 : le second email part 7 jours avant la suppression
export const FINAL_NOTICE_DAYS = 7;
export const TOKEN_GRACE_HOURS = 24;
export const AUDIT_LOG_MONTHS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `now` moins N années calendaires (gère les années bissextiles). */
function yearsBefore(now, years) {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

/**
 * Filtre Prisma : « comptes citoyens dont la dernière activité connue
 * est antérieure à `cutoff` ». Dernière activité = dernière connexion,
 * ou création du compte pour ceux qui ne se sont jamais connectés
 * depuis l'ajout du champ lastLoginAt.
 */
function inactiveSince(cutoff) {
  return {
    role: 'CITIZEN',
    OR: [
      { lastLoginAt: { lt: cutoff } },
      { lastLoginAt: null, createdAt: { lt: cutoff } },
    ],
  };
}

/**
 * Efface les jetons expirés ou déjà utilisés depuis plus de 24 h.
 * @returns {Promise<number>} nombre de jetons supprimés (ou à supprimer en dryRun)
 */
export async function purgeExpiredTokens({ now = new Date(), dryRun = false } = {}) {
  const limit = new Date(now.getTime() - TOKEN_GRACE_HOURS * 60 * 60 * 1000);
  const where = { OR: [{ expiresAt: { lt: limit } }, { usedAt: { lt: limit } }] };
  if (dryRun) return prisma.authToken.count({ where });
  const { count } = await prisma.authToken.deleteMany({ where });
  return count;
}

/**
 * Prévient les comptes qui atteindront 3 ans d'inactivité dans les
 * 30 prochains jours (et qui n'ont pas encore été prévenus).
 * @returns {Promise<{ warned: number, failed: number }>}
 */
export async function warnInactiveAccounts({ now = new Date(), dryRun = false } = {}) {
  // Inactifs depuis (3 ans − 30 jours) → la suppression tombera dans 30 jours
  const warningCutoff = new Date(yearsBefore(now, INACTIVITY_YEARS).getTime() + WARNING_NOTICE_DAYS * DAY_MS);
  const users = await prisma.user.findMany({
    where: { ...inactiveSince(warningCutoff), inactivityWarnedAt: null },
    select: { id: true, email: true },
  });
  if (dryRun) return { warned: users.length, failed: 0 };

  const deletionDate = new Date(now.getTime() + WARNING_NOTICE_DAYS * DAY_MS);
  let warned = 0;
  let failed = 0;
  // Un envoi à la fois : quelques comptes par jour tout au plus, et
  // cela ménage le quota d'envoi du fournisseur d'emails.
  for (const user of users) {
    const sent = await sendInactivityWarning(user.email, deletionDate);
    if (sent) {
      await prisma.user.update({ where: { id: user.id }, data: { inactivityWarnedAt: now } });
      warned += 1;
    } else {
      failed += 1; // retenté au prochain passage (inactivityWarnedAt reste null)
    }
  }
  return { warned, failed };
}

/**
 * Second email, le « dernier rappel » (S5R2-09) : aux comptes prévenus
 * une première fois il y a au moins 23 jours (30 − 7), toujours
 * inactifs, et pas encore relancés.
 *
 * Analogie : la lettre de relance de la bibliothèque, une semaine
 * avant la radiation — au cas où la première se serait perdue
 * (vacances, dossier « spam », boîte pleine).
 *
 * @returns {Promise<{ warned: number, failed: number }>}
 */
export async function sendFinalInactivityWarnings({ now = new Date(), dryRun = false } = {}) {
  const firstWarnedBefore = new Date(now.getTime() - (WARNING_NOTICE_DAYS - FINAL_NOTICE_DAYS) * DAY_MS);
  const warningCutoff = new Date(yearsBefore(now, INACTIVITY_YEARS).getTime() + WARNING_NOTICE_DAYS * DAY_MS);
  const users = await prisma.user.findMany({
    where: {
      ...inactiveSince(warningCutoff),
      inactivityWarnedAt: { lte: firstWarnedBefore },
      inactivityFinalWarnedAt: null,
    },
    select: { id: true, email: true, inactivityWarnedAt: true },
  });
  if (dryRun) return { warned: users.length, failed: 0 };

  let warned = 0;
  let failed = 0;
  for (const user of users) {
    // La date annoncée : celle promise dans le premier email, ou plus
    // tard si ce rappel part en retard — jamais moins de 7 jours
    const promised = user.inactivityWarnedAt.getTime() + WARNING_NOTICE_DAYS * DAY_MS;
    const deletionDate = new Date(Math.max(promised, now.getTime() + FINAL_NOTICE_DAYS * DAY_MS));
    const sent = await sendInactivityWarning(user.email, deletionDate, { final: true });
    if (sent) {
      await prisma.user.update({ where: { id: user.id }, data: { inactivityFinalWarnedAt: now } });
      warned += 1;
    } else {
      failed += 1; // retenté au prochain passage
    }
  }
  return { warned, failed };
}

/**
 * Supprime les comptes inactifs depuis 3 ans, prévenus une première
 * fois depuis au moins 30 jours ET relancés (dernier rappel) depuis
 * au moins 7 jours (S5R2-09). La suppression suit les mêmes règles que « Supprimer
 * mon compte » : votes et jetons effacés (cascade), réponses aux
 * enquêtes et propositions détachées du compte (SET NULL).
 * @returns {Promise<number>} nombre de comptes supprimés
 */
export async function deleteInactiveAccounts({ now = new Date(), dryRun = false } = {}) {
  const where = {
    ...inactiveSince(yearsBefore(now, INACTIVITY_YEARS)),
    inactivityWarnedAt: { lte: new Date(now.getTime() - WARNING_NOTICE_DAYS * DAY_MS) },
    inactivityFinalWarnedAt: { lte: new Date(now.getTime() - FINAL_NOTICE_DAYS * DAY_MS) },
  };
  if (dryRun) return prisma.user.count({ where });
  const { count } = await prisma.user.deleteMany({ where });
  return count;
}

/**
 * Efface les lignes du journal d'administration de plus de 6 mois.
 * @returns {Promise<number>} nombre de lignes supprimées
 */
export async function purgeOldAuditLogs({ now = new Date(), dryRun = false } = {}) {
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() - AUDIT_LOG_MONTHS);
  const where = { createdAt: { lt: limit } };
  if (dryRun) return prisma.adminAuditLog.count({ where });
  const { count } = await prisma.adminAuditLog.deleteMany({ where });
  return count;
}

/**
 * Efface les compteurs d'essais de connexion dont l'heure est passée
 * (S5R-13b) : ils ne bloquent plus rien et ne servent plus à rien.
 * @returns {Promise<number>} nombre de lignes supprimées
 */
export async function purgeExpiredThrottles({ now = new Date(), dryRun = false } = {}) {
  const where = { windowStart: { lte: new Date(now.getTime() - WINDOW_MS) } };
  if (dryRun) return prisma.loginThrottle.count({ where });
  const { count } = await prisma.loginThrottle.deleteMany({ where });
  return count;
}

/**
 * Passe complète, dans l'ordre : suppressions d'abord (elles
 * concernent des comptes prévenus lors de passages PRÉCÉDENTS), puis
 * derniers rappels, puis nouveaux avertissements, puis jetons.
 */
export async function runRetention({ now = new Date(), dryRun = false } = {}) {
  const deletedAccounts = await deleteInactiveAccounts({ now, dryRun });
  const finalWarnings = await sendFinalInactivityWarnings({ now, dryRun });
  const { warned, failed } = await warnInactiveAccounts({ now, dryRun });
  const deletedTokens = await purgeExpiredTokens({ now, dryRun });
  const deletedAuditLogs = await purgeOldAuditLogs({ now, dryRun });
  const deletedThrottles = await purgeExpiredThrottles({ now, dryRun });
  return {
    dryRun,
    deletedAccounts,
    warnedAccounts: warned,
    finalWarnedAccounts: finalWarnings.warned,
    // Les échecs des deux emails réunis : le script sort en erreur s'il y en a
    failedWarnings: failed + finalWarnings.failed,
    deletedTokens,
    deletedAuditLogs,
    deletedThrottles,
  };
}
