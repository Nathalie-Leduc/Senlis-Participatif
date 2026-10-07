// ══════════════════════════════════════════════════════════
// Carte « Explorer » : qu'est-ce qui concerne tel quartier ? (S5R-11)
//
// Recette du 30/09 : « Explorer la carte » ne montrait que les
// propositions (et seulement celles qui ont un point GPS), jamais les
// enquêtes. On rattache désormais chaque proposition ET chaque enquête
// ouverte à des quartiers :
//  - proposition : sa zone (S5R-10) — toute la ville, ou ses quartiers ;
//  - enquête : son public visé (S5R-07) — les quartiers de résidence ou
//    de travail visés ; « tout le monde », ou un public sans quartier
//    précis (hors Senlis, « tous les salarié·es »…), vaut toute la ville.
// Un élément « toute la ville » apparaît dans CHAQUE quartier.
// ══════════════════════════════════════════════════════════

import { ZONE_QUARTIERS } from '../constants/zones.js';
import { isEveryone } from './audience.js';

const ALL = ZONE_QUARTIERS.map((q) => q.value);
const NOT_CENTRE = ALL.filter((q) => q !== 'CENTRE_HISTORIQUE');

/** @returns {{ wholeCity: boolean, quartiers: string[] }} */
export function proposalPlaces(proposal) {
  return { wholeCity: Boolean(proposal.zoneWholeCity), quartiers: proposal.zoneQuartiers ?? [] };
}

/** @returns {{ wholeCity: boolean, quartiers: string[] }} */
export function surveyPlaces(survey) {
  const a = survey.audience;
  if (!a || isEveryone(a)) return { wholeCity: true, quartiers: [] };

  const quartiers = new Set();
  let wholeCity = false;
  if (a.situations.includes('CENTRE_RESIDENT')) quartiers.add('CENTRE_HISTORIQUE');
  if (a.situations.includes('AUTRE_QUARTIER')) (a.quartiers.length ? a.quartiers : NOT_CENTRE).forEach((q) => quartiers.add(q));
  if (a.situations.includes('HORS_SENLIS')) wholeCity = true; // des visiteurs : la ville entière
  if (a.workQuartiers.length) a.workQuartiers.forEach((q) => quartiers.add(q));
  else if (a.workTypes.length) wholeCity = true; // « les salarié·es », où qu'ils travaillent
  return { wholeCity, quartiers: [...quartiers] };
}

const concerns = (places, quartier) => places.wholeCity || places.quartiers.includes(quartier);

/**
 * @returns {{ proposals: object[], surveys: object[] }} ce qui concerne ce
 *   quartier — chaque élément porte `wholeCity` pour l'afficher à part
 */
export function itemsForQuartier(quartier, proposals, surveys) {
  return {
    proposals: proposals.filter((p) => concerns(proposalPlaces(p), quartier))
      .map((p) => ({ ...p, wholeCity: proposalPlaces(p).wholeCity })),
    surveys: surveys.filter((s) => concerns(surveyPlaces(s), quartier))
      .map((s) => ({ ...s, wholeCity: surveyPlaces(s).wholeCity })),
  };
}

/** Éléments qui ne sont rattachés à AUCUN quartier (zone non déclarée) */
export function unplacedProposals(proposals) {
  return proposals.filter((p) => !p.zoneWholeCity && !(p.zoneQuartiers?.length));
}
