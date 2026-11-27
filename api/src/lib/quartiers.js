// ══════════════════════════════════════════════════════════
// Les quartiers de Senlis — une seule liste pour toute l'API
// (S5R2-06 : avant, la même liste était recopiée dans trois validateurs)
//
// 8 quartiers : les 7 IRIS de l'INSEE, dont le « Centre Ville » est
// coupé en deux d'après le plan municipal de 2018 :
//   - CENTRE_HISTORIQUE : le Centre historique (ex-« Centre-Sud ») ;
//   - SAINT_VINCENT     : le Quartier Saint-Vincent (ex-« Centre-Est –
//                         Saint-Vincent »).
// Mêmes valeurs que l'enum Quartier de prisma/schema.prisma.
//
// Analogie : un immeuble dont on a divisé un grand appartement en
// deux — l'adresse de l'immeuble (l'IRIS) ne change pas, mais il y a
// désormais deux portes, donc deux noms sur les boîtes aux lettres.
// ══════════════════════════════════════════════════════════

/**
 * Quartiers de RÉSIDENCE à préciser quand Situation = AUTRE_QUARTIER.
 * Pas le Centre historique : Situation.CENTRE_RESIDENT le couvre déjà.
 * Saint-Vincent, lui, est « un autre quartier » (décision du 09/10).
 */
export const QUARTIERS_RESIDENCE = [
  'SAINT_VINCENT', 'BRICHEBAY', 'BON_SECOURS', 'VAL_AUNETTE_GATELIERE', 'ZONE_INDUSTRIELLE', 'VILLEVERT', 'JARDINIERS',
];

/** Tous les quartiers : lieu de travail, zone d'une proposition */
export const QUARTIERS = ['CENTRE_HISTORIQUE', ...QUARTIERS_RESIDENCE];
