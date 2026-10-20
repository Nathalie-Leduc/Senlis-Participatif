// ══════════════════════════════════════════════════════════
// Parkings gérés par l'administration (S5R2-05) — libellés, couleurs
// des repères et légende des tarifs.
//
// Les couleurs reprennent celles du plan et du guide de la Ville (bleu
// gratuit, rouge, vert, orange, jaune pour la gare) : quelqu'un qui
// connaît le dépliant s'y retrouve. La couleur n'est jamais seule : le
// repère porte une lettre et l'infobulle dit le régime en toutes lettres.
// ══════════════════════════════════════════════════════════

/** Régimes : libellé, lettre du repère, couleurs (fond / texte) */
export const PARKING_REGIMES = {
  GRATUIT: { label: 'Gratuit', letter: 'P', bg: '#1E5F7C', fg: '#FFFFFF' },
  ZONE_ROUGE: { label: 'Zone rouge — payant, courte durée', letter: 'R', bg: '#B8432B', fg: '#FFFFFF' },
  ZONE_VERTE: { label: 'Zone verte — payant, longue durée', letter: 'V', bg: '#3A7A4D', fg: '#FFFFFF' },
  DUREE_LIMITEE: { label: 'Durée limitée — disque obligatoire', letter: 'D', bg: '#4E6E7E', fg: '#FFFFFF' },
  PARC_PAYANT: { label: 'Parc payant (tarif propre)', letter: '€', bg: '#E07B28', fg: '#26333A' },
  GARE: { label: 'Parking de la gare', letter: 'G', bg: '#F0C45A', fg: '#26333A' },
};
/** Régime pas encore renseigné */
export const UNKNOWN_REGIME = { label: 'Régime à préciser', letter: '?', bg: '#948B7D', fg: '#FFFFFF' };
export const regimeMeta = (regime) => PARKING_REGIMES[regime] ?? UNKNOWN_REGIME;

export const PARKING_CHARGING = {
  AUCUNE: 'Aucune',
  EXISTANTE: 'Bornes installées',
  EN_PROJET: 'Bornes en projet',
};

export const PARKINGS_SOURCE = 'Ville de Senlis : plan des parkings du centre-ville (septembre 2023) et guide du stationnement (Indigo, janvier 2025)';

// ── Légende des tarifs (guide du stationnement, janvier 2025) ──
// Recopiée telle quelle ; « indicatifs » comme sur le guide lui-même.
export const TARIFS_2025 = {
  horaires: 'En voirie, payant du lundi au samedi de 8 h à 19 h, toute l’année. Gratuit le dimanche et les jours fériés.',
  gratuite: '30 min gratuites de mi-janvier à mi-mars, puis 1 h gratuite à partir de mi-mars — une fois par jour et par véhicule, non sécable.',
  zones: [
    { regime: 'ZONE_ROUGE', title: 'Zone rouge — courte durée, 2 h 30 maximum', exemples: '1 h : 1,50 € · 2 h : 4,00 € · 2 h 30 : 20,00 €', places: '100 places' },
    { regime: 'ZONE_VERTE', title: 'Zone verte — longue durée, 4 h 30 maximum', exemples: '1 h : 1,20 € · 2 h : 2,40 € · 4 h : 4,80 € · 4 h 30 : 20,00 €', places: '350 places' },
  ],
  fps: 'Sans ticket ou au-delà de la durée payée : forfait post-stationnement de 20 €.',
  abonnements: [
    'Résidents du centre (zone verte) : 1er véhicule 20 €/mois ou 200 €/an, 2e véhicule 10 €/mois ou 100 €/an ; ticket journalier 5 €.',
    'Professionnels travaillant au centre : abonnement au parking de la gare, 20 €/mois ou 200 €/an.',
  ],
  pmr: 'Carte mobilité inclusion « stationnement » ou carte européenne : gratuit sur toutes les places, payantes comprises, 12 h maximum (40 places réservées).',
  gratuits: 'Environ 1 350 places gratuites (75 % des places du centre-ville et de son pourtour) ; 44 bornes de recharge électrique.',
  mention: 'Tarifs indicatifs (guide du stationnement de la Ville, janvier 2025) — seuls les tarifs affichés sur place font foi.',
};
