// ══════════════════════════════════════════════════════════
// Rôles des comptes — une seule source de vérité (S5R2-11)
//
//   CITIZEN → citoyen·ne : vote, répond aux enquêtes
//   EDITOR  → « Admin-test » (mairie, maison de quartier, partenaire) :
//             prépare et teste des BROUILLONS, ne publie jamais
//   ADMIN   → l'administration : tout, y compris publier et gérer les comptes
//
// Analogie : la cuisine d'un restaurant. L'apprenti (EDITOR) prépare
// et goûte autant qu'il veut ; seul le chef (ADMIN) envoie l'assiette
// en salle. Les deux sont « en cuisine » : c'est l'ÉQUIPE (staff).
// ══════════════════════════════════════════════════════════

export const ROLES = Object.freeze({
  CITIZEN: 'CITIZEN',
  EDITOR: 'EDITOR',
  ADMIN: 'ADMIN',
});

/** Les rôles « en cuisine » : accès à l'administration, 2FA, pas de vote. */
export const STAFF_ROLES = Object.freeze([ROLES.ADMIN, ROLES.EDITOR]);

/**
 * @param {string | undefined} role
 * @returns {boolean} true pour ADMIN et EDITOR
 * @example isStaffRole('EDITOR') // true — isStaffRole('CITIZEN') // false
 */
export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}
