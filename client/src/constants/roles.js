// ══════════════════════════════════════════════════════════
// Rôles des comptes — libellés et couleurs (S5R2-11)
// Mêmes valeurs que l'enum Role de l'API (schema.prisma).
//
// L'ordre compte : c'est celui du menu de la page « Comptes »,
// du moins au plus puissant (comme les grades d'une brigade de
// cuisine : commis, second, chef).
// ══════════════════════════════════════════════════════════

export const ROLE_META = {
  CITIZEN: {
    label: 'Citoyen',
    description: 'vote et répond aux enquêtes',
    color: '#26333A', bg: '#EFEBE2',
  },
  EDITOR: {
    label: 'Admin-test',
    description: 'prépare et teste des brouillons, ne publie jamais',
    color: '#5C4510', bg: '#FFF4D6',
  },
  ADMIN: {
    label: 'Administrateur',
    description: 'tous les droits : publier, résultats, comptes',
    color: '#1E5F7C', bg: '#E3EEF3',
  },
};

export const ROLE_OPTIONS = Object.entries(ROLE_META).map(([value, meta]) => ({ value, ...meta }));
