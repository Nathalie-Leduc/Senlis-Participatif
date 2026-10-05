// ══════════════════════════════════════════════════════════
// Public visé d'une enquête (S5R-07)
//
// Recette du 30/09 : « Le choix du public visé doit pouvoir se faire
// en fonction des profils : tous, habitants, quartier, commerçants,
// gérants, employés, hors Senlis… ». L'ancien choix unique (TOUS /
// RESIDENTS / COMMERCANTS) est remplacé par des critères combinables.
//
// Deux familles de critères, reliées par un OU :
//  - RÉSIDENCE : situations visées (centre historique, autre quartier,
//    hors Senlis) ; pour « autre quartier », lesquels (aucun coché =
//    tous les autres quartiers) ;
//  - TRAVAIL : quartier(s) de travail et/ou rôle(s) (dirigeant·e,
//    salarié·e). Une liste vide = n'importe lequel ; au sein de cette
//    famille, les deux critères s'additionnent (ET) : « salarié·es DU
//    centre » = quartier centre ET rôle salarié·e.
//
// Analogie : une affiche « Réunion pour les habitants du centre ET les
// commerçants de la rue de Paris » — on est concerné si l'on entre dans
// l'UNE des deux catégories.
//
// ⚠️ Le public visé ne FILTRE pas qui peut répondre : le profil est
// déclaratif, souvent incomplet, et l'avis d'une personne hors cible
// reste le bienvenu. Il sert à ANNONCER la cible, à indiquer à chacun
// s'il est concerné, et à comparer, dans les résultats, les réponses du
// public visé et celles des autres.
// ══════════════════════════════════════════════════════════

/** Les critères d'une enquête, sous une forme unique. */
export function audienceOf(survey) {
  return {
    situations: survey.audienceSituations ?? [],
    quartiers: survey.audienceQuartiers ?? [],
    workQuartiers: survey.audienceWorkQuartiers ?? [],
    workTypes: survey.audienceWorkTypes ?? [],
  };
}

/** Aucun critère = tout le monde. */
export function isEveryone(audience) {
  return Object.values(audience).every((list) => list.length === 0);
}

/**
 * Cette personne fait-elle partie du public visé ?
 *
 * @param {ReturnType<typeof audienceOf>} audience
 * @param {{ situation?: string|null, quartier?: string|null, travailleASenlis?: boolean|null,
 *   travailleQuartier?: string|null, travailType?: string|null } | null} user
 * @returns {boolean|null} true = visée · false = pas visée ·
 *   null = on ne sait pas (profil trop incomplet pour trancher, ou
 *   compte supprimé). On ne déclare JAMAIS « pas concerné·e » sur la
 *   base d'une information manquante.
 */
export function matchesAudience(audience, user) {
  if (isEveryone(audience)) return true;
  if (!user) return null;

  const residenceTargeted = audience.situations.length > 0;
  const workTargeted = audience.workQuartiers.length > 0 || audience.workTypes.length > 0;
  let unknown = false;

  // ── Famille RÉSIDENCE ──
  if (residenceTargeted) {
    if (!user.situation) {
      unknown = true;
    } else if (audience.situations.includes(user.situation)) {
      const quartierFilter = user.situation === 'AUTRE_QUARTIER' && audience.quartiers.length > 0;
      if (!quartierFilter) return true;
      if (!user.quartier) unknown = true;
      else if (audience.quartiers.includes(user.quartier)) return true;
    }
  }

  // ── Famille TRAVAIL ──
  if (workTargeted) {
    const works = user.travailleASenlis ?? (user.travailleQuartier ? true : null);
    if (works === null) {
      unknown = true;
    } else if (works) {
      const quartierOk = audience.workQuartiers.length === 0
        || (user.travailleQuartier ? audience.workQuartiers.includes(user.travailleQuartier) : null);
      const typeOk = audience.workTypes.length === 0
        || (user.travailType ? audience.workTypes.includes(user.travailType) : null);
      if (quartierOk === true && typeOk === true) return true;
      if (quartierOk === null || typeOk === null) unknown = true;
    }
  }

  return unknown ? null : false;
}

/** Champs du profil nécessaires à matchesAudience (pour les select Prisma). */
export const AUDIENCE_PROFILE_SELECT = {
  situation: true, quartier: true, travailleASenlis: true, travailleQuartier: true, travailType: true,
};
