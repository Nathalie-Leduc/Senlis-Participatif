// ══════════════════════════════════════════════════════════
// Modèles de proposition (S5R2-12, recette du 08/10)
//
// Chaque modèle préremplit un exemple de titre, d'accroche, et un
// ARGUMENTAIRE STRUCTURÉ en quatre parties, toujours les mêmes :
//   1. Contexte                 — ce qui existe, ce qui coince
//   2. Ce qui changerait        — le projet, concrètement
//   3. Pour qui                 — les personnes concernées
//   4. Questions encore ouvertes — ce qu'on ne sait pas encore
//
// Les passages entre [crochets] sont à remplacer : le formulaire
// prévient s'il en reste au moment d'enregistrer.
//
// Analogie : un formulaire de demande de subvention. Les rubriques
// sont imposées pour que rien d'important ne soit oublié, et pour que
// toutes les propositions se lisent de la même façon.
//
// Contraintes (mêmes que l'API, validators/proposals.js) : titre
// 5 à 200 caractères, accroche 10 à 300, argumentaire ≥ 20 — vérifiées
// par proposalTemplates.test.js.
// ══════════════════════════════════════════════════════════

/** Les quatre rubriques de l'argumentaire, dans l'ordre */
export const CONTENT_SECTIONS = ['Contexte', 'Ce qui changerait', 'Pour qui', 'Questions encore ouvertes'];

/**
 * Construit l'argumentaire à partir d'une aide par rubrique.
 * Une ligne vide entre les rubriques : chaque bloc devient un
 * paragraphe sur la page publique (un saut de ligne = un paragraphe).
 * @param {string[]} hints - une consigne entre crochets par rubrique
 */
function structuredContent(hints) {
  return CONTENT_SECTIONS.map((section, i) => `${section}\n${hints[i]}`).join('\n\n');
}

export const PROPOSAL_TEMPLATES = [
  {
    id: 'blank',
    name: 'Page blanche',
    summary: 'Tout écrire soi-même, sans rubriques.',
    title: '',
    summaryText: '',
    content: '',
  },
  {
    id: 'public-space',
    name: 'Aménagement de l\'espace public',
    summary: 'Place, rue, square, bancs, éclairage, trottoirs.',
    title: 'Aménager [lieu] pour [usage]',
    summaryText: '[Quoi] [où], pour [qui ou quel usage].',
    content: structuredContent([
      '[Ce lieu aujourd\'hui : à quoi il sert, ce qui manque ou gêne. Un chiffre ou une observation si possible.]',
      '[Le projet concrètement : ce qui serait installé, déplacé ou supprimé, et où exactement.]',
      '[Les habitants, commerçants, enfants, personnes âgées ou visiteurs concernés.]',
      '[Ce qui reste à décider : coût, calendrier, entretien, avis des riverains…]',
    ]),
  },
  {
    id: 'mobility',
    name: 'Mobilité et stationnement',
    summary: 'Circulation, vélo, piétons, bus, places de stationnement.',
    title: 'Faciliter [déplacement] entre [lieu A] et [lieu B]',
    summaryText: '[Ce qui changerait] pour [à pied, à vélo, en bus ou en voiture], [où].',
    content: structuredContent([
      '[Comment on se déplace ou on se gare aujourd\'hui à cet endroit, et ce qui pose problème.]',
      '[Le changement proposé : sens de circulation, piste, places, horaires, signalisation…]',
      '[Qui y gagne, et qui devrait changer ses habitudes.]',
      '[Les points à étudier : report de circulation, livraisons, accès des secours, coût…]',
    ]),
  },
  {
    id: 'greening',
    name: 'Végétalisation',
    summary: 'Arbres, jardins partagés, îlots de fraîcheur, fleurissement.',
    title: 'Végétaliser [lieu]',
    summaryText: 'Planter [quoi] [où], pour [ombre, fraîcheur, biodiversité…].',
    content: structuredContent([
      '[Le lieu aujourd\'hui : sol, ombre, chaleur en été, usages.]',
      '[Ce qui serait planté ou créé, et l\'entretien prévu (qui arrose ?).]',
      '[Les riverains, écoles, promeneurs, commerçants concernés.]',
      '[Les contraintes : réseaux souterrains, accès, choix des espèces, budget…]',
    ]),
  },
  {
    id: 'event',
    name: 'Animation ou événement',
    summary: 'Fête, marché, concert, rencontre, animation régulière.',
    title: 'Organiser [événement] à [lieu]',
    summaryText: '[Événement] [quand], [où], ouvert à [qui].',
    content: structuredContent([
      '[Pourquoi cet événement : ce qui manque aujourd\'hui, ce qui existe déjà ailleurs.]',
      '[Le déroulé : date ou fréquence, durée, lieu, programme, partenaires possibles.]',
      '[Le public attendu, et les associations ou commerçants qui pourraient y participer.]',
      '[Ce qui reste à régler : sécurité, autorisations, bruit, budget, bénévoles…]',
    ]),
  },
];

/** Passages encore à compléter : du texte entre crochets, ex. « [lieu] » */
const PLACEHOLDER = /\[[^\]]+\]/;

/**
 * @param {...string} texts
 * @returns {boolean} true s'il reste au moins un « [à compléter] »
 * @example hasPlaceholders('Aménager [lieu]') // true
 */
export function hasPlaceholders(...texts) {
  return texts.some((text) => PLACEHOLDER.test(text ?? ''));
}
