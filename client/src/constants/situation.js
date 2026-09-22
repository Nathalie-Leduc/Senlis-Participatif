// ══════════════════════════════════════════════════════════
// Libellés de la situation déclarée — même principe que
// surveyStatus.js/proposalStatus.js : centralisé pour que
// l'inscription, Mon compte et les stats admin affichent
// toujours les mêmes libellés.
// ══════════════════════════════════════════════════════════

export const SITUATION_OPTIONS = [
  { value: 'CENTRE_RESIDENT', label: "J'habite le centre historique" },
  { value: 'AUTRE_QUARTIER', label: "J'habite un autre quartier de Senlis" },
  { value: 'HORS_SENLIS', label: 'Je ne réside pas à Senlis' },
];

// Version courte, pour les tableaux/statistiques admin (moins de
// place qu'un menu déroulant).
export const SITUATION_SHORT_LABELS = {
  CENTRE_RESIDENT: 'Résident du centre',
  AUTRE_QUARTIER: 'Autre quartier de Senlis',
  HORS_SENLIS: 'Hors Senlis',
  NON_RENSEIGNEE: 'Non renseignée',
};

// Les 6 quartiers IRIS (INSEE) de Senlis autres que le centre
// historique — affiché en cascade uniquement quand la situation
// choisie est AUTRE_QUARTIER, pour que ces citoyens ne se sentent
// pas réduits à une case fourre-tout, et pour pouvoir cibler de
// futures enquêtes/propositions par quartier précis.
export const QUARTIER_OPTIONS = [
  { value: 'BRICHEBAY', label: 'Brichebay' },
  { value: 'BON_SECOURS', label: 'Bon Secours' },
  { value: 'VAL_AUNETTE_GATELIERE', label: "Val d'Aunette - La Gâtelière" },
  { value: 'ZONE_INDUSTRIELLE', label: 'Zone industrielle' },
  { value: 'VILLEVERT', label: 'Villevert' },
  { value: 'JARDINIERS', label: 'Jardiniers' },
];

export const QUARTIER_LABELS = Object.fromEntries(
  QUARTIER_OPTIONS.map((o) => [o.value, o.label]),
);

// Même liste que QUARTIER_OPTIONS, mais avec le centre historique en
// plus — a du sens comme lieu de TRAVAIL (contrairement à la
// résidence, où SITUATION_OPTIONS couvre déjà ce cas séparément).
export const TRAVAIL_QUARTIER_OPTIONS = [
  { value: 'CENTRE_HISTORIQUE', label: 'Centre historique' },
  ...QUARTIER_OPTIONS,
];

export const TRAVAIL_QUARTIER_LABELS = Object.fromEntries(
  TRAVAIL_QUARTIER_OPTIONS.map((o) => [o.value, o.label]),
);

export const TRAVAIL_TYPE_OPTIONS = [
  { value: 'COMMERCANT', label: "Je dirige/gère cette activité" },
  { value: 'SALARIE', label: "J'y suis salarié(e)" },
];

export const TRAVAIL_TYPE_LABELS = {
  COMMERCANT: 'Dirige/gère l\'activité',
  SALARIE: 'Salarié(e)',
};
