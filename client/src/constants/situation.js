// ══════════════════════════════════════════════════════════
// Libellés de la situation déclarée — même principe que
// surveyStatus.js/proposalStatus.js : centralisé pour que
// l'inscription, Mon compte et les stats admin affichent
// toujours les mêmes libellés.
// ══════════════════════════════════════════════════════════

export const SITUATION_OPTIONS = [
  { value: 'CENTRE_RESIDENT', label: "J'habite le centre historique" },
  { value: 'CENTRE_COMMERCANT', label: 'Je commerce/travaille dans le centre historique' },
  { value: 'AUTRE_QUARTIER', label: "J'habite un autre quartier de Senlis" },
  { value: 'HORS_SENLIS', label: 'Je ne réside pas à Senlis' },
];

// Version courte, pour les tableaux/statistiques admin (moins de
// place qu'un menu déroulant).
export const SITUATION_SHORT_LABELS = {
  CENTRE_RESIDENT: 'Résident du centre',
  CENTRE_COMMERCANT: 'Commerçant du centre',
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
