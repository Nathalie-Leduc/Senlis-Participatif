// ══════════════════════════════════════════════════════════
// Libellés et couleurs des statuts d'enquête — même principe
// que proposalStatus.js : centralisé pour que la liste admin ET
// le constructeur affichent toujours les mêmes libellés.
// ══════════════════════════════════════════════════════════

export const STATUS_META = {
  DRAFT: { label: 'Brouillon', color: '#6B6257', bg: '#EFEBE2' },
  // Audit accessibilité (S5-05) : même correctif que proposalStatus.js
  // — #3A7A4D sur #E0F2E5 échouait de justesse le contraste AA.
  OPEN: { label: 'Ouverte', color: '#377349', bg: '#E0F2E5' },
  CLOSED: { label: 'Clôturée', color: '#1E5F7C', bg: '#E3EEF3' },
};

export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

// (S5R-07 : AUDIENCE_OPTIONS supprimé — le public visé se choisit
// désormais par critères de profil, voir components/AudiencePicker)

// Libellés + info "a besoin d'options" pour le constructeur.
export const QUESTION_TYPE_META = {
  CHOIX_UNIQUE: { label: 'Choix unique (une seule réponse)', needsOptions: true },
  CHOIX_MULTIPLE: { label: 'Choix multiple (plusieurs réponses)', needsOptions: true },
  OUI_NON: { label: 'Oui / Non', needsOptions: 'optional' },
  NOMBRE: { label: 'Nombre', needsOptions: false },
  TEXTE_LIBRE: { label: 'Texte libre', needsOptions: false },
};

export const QUESTION_TYPE_OPTIONS = Object.entries(QUESTION_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));
