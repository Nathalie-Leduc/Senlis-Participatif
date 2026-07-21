// ══════════════════════════════════════════════════════════
// Libellés et couleurs des statuts d'enquête — même principe
// que proposalStatus.js : centralisé pour que la liste admin ET
// le constructeur affichent toujours les mêmes libellés.
// ══════════════════════════════════════════════════════════

export const STATUS_META = {
  DRAFT: { label: 'Brouillon', color: '#6B6257', bg: '#EFEBE2' },
  OPEN: { label: 'Ouverte', color: '#3A7A4D', bg: '#E0F2E5' },
  CLOSED: { label: 'Clôturée', color: '#1E5F7C', bg: '#E3EEF3' },
};

export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const AUDIENCE_OPTIONS = [
  { value: 'TOUS', label: 'Tous les habitants' },
  { value: 'RESIDENTS', label: 'Résidents' },
  { value: 'COMMERCANTS', label: 'Commerçants' },
];

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
