// ══════════════════════════════════════════════════════════
// Journal des actions d'administration (S5A-06)
//
// Répond, des mois plus tard, à « qui a fait ça, et quand ? » :
// changer le rôle d'un compte, publier, modifier ou supprimer une
// proposition, créer ou modifier une enquête, se connecter en admin.
// Recommandé par l'ANSSI (imputabilité) et la CNIL (délibération
// n° 2021-122 sur la journalisation), et indispensable le jour où la
// mairie demandera « qui a supprimé cette proposition ? ».
//
// Analogie : la main courante d'un commissariat. Chaque événement y
// est inscrit, daté, signé — et on ne revient jamais effacer une
// ligne (hors purge après 6 mois, voir services/retention.js).
//
// Règles :
//  - on journalise APRÈS le succès de l'action (une action refusée
//    n'a pas eu lieu) ;
//  - jamais de secret (mot de passe, jeton) ni de contenu citoyen ;
//  - un échec d'écriture du journal ne doit pas faire échouer
//    l'action elle-même : on le signale dans la console serveur.
// ══════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';

/** Codes d'action — une liste fermée, pour des recherches fiables. */
export const AUDIT_ACTIONS = {
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  PROPOSAL_CREATED: 'PROPOSAL_CREATED',
  PROPOSAL_UPDATED: 'PROPOSAL_UPDATED',
  PROPOSAL_IMAGE_UPLOADED: 'PROPOSAL_IMAGE_UPLOADED',
  PROPOSAL_DELETED: 'PROPOSAL_DELETED',
  SURVEY_CREATED: 'SURVEY_CREATED',
  SURVEY_UPDATED: 'SURVEY_UPDATED',
  SURVEY_DELETED: 'SURVEY_DELETED',
};

/**
 * Inscrit une action dans le journal.
 *
 * @param {object} entry
 * @param {string} entry.actorId - id de l'admin qui agit (req.user.userId)
 * @param {string} entry.action - une valeur de AUDIT_ACTIONS
 * @param {string} [entry.targetType] - ex. 'Proposal', 'Survey', 'User'
 * @param {string} [entry.targetId]
 * @param {object} [entry.details] - quelques infos utiles, sans donnée superflue
 *
 * @example
 * await logAdminAction({
 *   actorId: req.user.userId,
 *   action: AUDIT_ACTIONS.PROPOSAL_DELETED,
 *   targetType: 'Proposal', targetId: id,
 *   details: { title: existing.title },
 * });
 */
export async function logAdminAction({ actorId, action, targetType, targetId, details }) {
  try {
    // Le pseudo est recopié AU MOMENT de l'action : si le compte est
    // supprimé plus tard (actorId → null), la ligne dit encore qui.
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { pseudo: true } });
    await prisma.adminAuditLog.create({
      data: {
        action,
        actorId,
        actorPseudo: actor?.pseudo ?? '(compte inconnu)',
        targetType,
        targetId,
        details,
      },
    });
  } catch (err) {
    console.error(`❌ Journal d'administration : impossible d'inscrire ${action} —`, err.message);
  }
}
