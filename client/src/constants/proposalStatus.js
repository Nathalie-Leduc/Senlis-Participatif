// ══════════════════════════════════════════════════════════
// Libellés et couleurs des statuts de proposition
//
// Centralisé ici pour que la liste admin ET le formulaire
// affichent toujours EXACTEMENT les mêmes libellés — sans ce
// fichier, on risquerait d'écrire "Brouillon" à un endroit et
// "En brouillon" à un autre, pour le même statut DRAFT.
// ══════════════════════════════════════════════════════════

export const STATUS_META = {
  DRAFT: { label: 'Brouillon', color: '#6B6257', bg: '#EFEBE2' },
  PENDING_REVIEW: { label: 'En attente', color: '#8a6d1f', bg: '#FFF4DB' },
  // Audit accessibilité (S5-05) : #3A7A4D sur #E0F2E5 ne passait le
  // contraste AA (4,42:1, sous le seuil 4,5:1 pour un texte de cette
  // taille) que de justesse — #377349 est visuellement quasi
  // identique mais passe à 4,85:1.
  PUBLISHED: { label: 'Publiée', color: '#377349', bg: '#E0F2E5' },
  REJECTED: { label: 'Rejetée', color: '#A8442F', bg: '#FCEAE6' },
  CLOSED: { label: 'Clôturée', color: '#1E5F7C', bg: '#E3EEF3' },
  ARCHIVED: { label: 'Archivée', color: '#948B7D', bg: '#F0EDE5' },
};

export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));
