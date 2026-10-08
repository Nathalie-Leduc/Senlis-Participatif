// ══════════════════════════════════════════════════════════
// Enquête « Stationnement et déplacements dans le centre historique »
// Version 3 — S5R-06, d'après la recette du 30/09/2026
//
// Séparée de seed-prod.js : c'est du CONTENU (des questions), que l'on
// relira et corrigera plus souvent que le code du seed. Le format est
// celui de l'API (voir validators/surveys.js) — un test vérifie qu'il
// passe la même validation qu'une enquête créée dans l'administration.
//
// ── Les parcours ─────────────────────────────────────────
// Chacun ne voit que les questions de SA situation (moteur v2, S5R-05) :
//
//  1. PROFIL (tout le monde) : résidence, travail à Senlis, quartier de
//     travail, rôle, type d'activité.
//  2. TRAVAIL DANS LE CENTRE (si on travaille dans le centre historique) :
//     comment on vient, où on se gare, difficultés, freins ; véhicules
//     professionnels.
//  3. VENIR DANS LE CENTRE (si on réside AILLEURS que dans le centre) :
//     fréquence, moyen, et stationnement si on vient en voiture. Un·e
//     salarié·e d'un autre quartier passe par ici, plus par le bloc
//     « travail » (recette, test 3 : le stationnement de son travail
//     ne concerne pas le centre).
//  4. RÉSIDER DANS LE CENTRE (si on y réside) — placé EN DERNIER : « pas
//     de véhicule » y termine l'enquête (recette, test 1) sans priver la
//     personne d'aucun bloc qui la concerne.
//  5. Une suggestion libre (tout le monde, sauf fin anticipée).
//
// Analogie : un plan de métro. Toutes les stations existent, mais
// chaque voyageur ne parcourt que sa ligne.
//
// Le moteur ne connaît que le « OU » entre conditions : chaque bloc est
// donc déclenché par UNE question précise (ex. le quartier de travail
// « Centre historique ») plutôt que par une combinaison « ET ».
// ══════════════════════════════════════════════════════════

// ── Listes réutilisées ───────────────────────────────────

const RESIDENCE_QUARTIERS = [
  { label: 'Brichebay', syncValue: 'BRICHEBAY' },
  { label: 'Bon Secours', syncValue: 'BON_SECOURS' },
  { label: "Val d'Aunette - La Gâtelière", syncValue: 'VAL_AUNETTE_GATELIERE' },
  { label: 'Zone industrielle', syncValue: 'ZONE_INDUSTRIELLE' },
  { label: 'Villevert', syncValue: 'VILLEVERT' },
  { label: 'Jardiniers', syncValue: 'JARDINIERS' },
];

// Le centre historique EN PREMIER : sa position (0) sert de condition
const TRAVAIL_QUARTIERS = [{ label: 'Centre historique', syncValue: 'CENTRE_HISTORIQUE' }, ...RESIDENCE_QUARTIERS];

const ACTIVITES = [
  { label: 'Commerce' },
  { label: 'Banque, assurance ou agence (immobilière, voyages…)' },
  { label: 'Cabinet médical ou paramédical' },
  { label: 'Restaurant, bar ou tabac' },
  { label: 'Service municipal (mairie, police…)' },
  { label: 'École' },
  { label: 'Autre activité' },
];

const MOBILITES = [
  { label: 'TUS (bus gratuit de Senlis)' },
  { label: 'Bus régional' },
  { label: 'Voiture' },
  { label: 'Scooter ou moto' },
  { label: 'Vélo' },
  { label: 'À pied' },
  { label: 'EDPM (Engins De Déplacement Personnel Motorisés)' },
  { label: 'Covoiturage' },
  { label: 'Autre' },
];

// « Je n'ai pas de véhicule » retiré (recette, test 1) : on ne pose
// cette question qu'à qui a déclaré au moins un véhicule
const STATIONNEMENTS = [
  { label: 'Box ou parking sur ma propriété / mon commerce' },
  { label: 'Box ou parking en location' },
  { label: 'Parking public gratuit dans le centre-ville' },
  { label: 'Parking payant dans le centre-ville, avec abonnement' },
  { label: 'Parking payant dans le centre-ville, sans abonnement' },
  { label: 'Dans la rue, devant ou près de chez moi' },
  { label: 'Parking gratuit autour du centre-ville' },
  { label: 'Parking payant autour du centre-ville, avec abonnement' },
  { label: 'Parking payant autour du centre-ville, sans abonnement' },
];

const FREINS = [
  { label: 'Difficulté de mobilité personnelle (PMR)' },
  { label: 'Le bus gratuit (TUS) ne dessert pas mon secteur' },
  { label: 'Le bus gratuit (TUS) ne passe pas assez souvent' },
  { label: 'Manque de pistes cyclables sécurisées' },
  { label: 'Circulation à vélo trop dangereuse' },
  // Rend la question obligatoire sans forcer une réponse fausse
  { label: 'Aucun frein : je préfère la voiture' },
  { label: 'Autre frein' },
];

const FREQUENCES = [
  { label: 'Tous les jours' },
  { label: 'Plusieurs fois par semaine' },
  { label: 'Occasionnellement' },
];

/** Position d'une option par son libellé : jamais de numéro tapé à la main */
const at = (options, label) => {
  const index = options.findIndex((o) => o.label === label);
  if (index === -1) throw new Error(`Option introuvable : ${label}`);
  return index;
};

/**
 * Construit la liste des questions. Chaque question retient sa propre
 * position via add() : insérer ou retirer une question ne décale
 * jamais les conditions des autres.
 */
function buildQuestions() {
  const questions = [];
  const add = (question) => {
    questions.push({ required: true, ...question });
    return questions.length - 1;
  };
  /** Raccourci : « affichée si la question q a reçu l'option d'index o » */
  const when = (questionOrder, optionOrder) => ({ questionOrder, optionOrder });

  // ══ 1. PROFIL ════════════════════════════════════════════
  const RESIDENCES = [
    { label: 'Le centre historique', syncValue: 'CENTRE_RESIDENT' },
    { label: 'Un autre quartier de Senlis', syncValue: 'AUTRE_QUARTIER' },
    { label: 'Une autre ville', syncValue: 'HORS_SENLIS' },
  ];
  const qResidence = add({
    label: 'Où résidez-vous ?', type: 'CHOIX_UNIQUE', syncsToProfile: 'situation', options: RESIDENCES,
  });
  const residentCentre = when(qResidence, 0);
  const residentAutreQuartier = when(qResidence, 1);
  const residentAutreVille = when(qResidence, 2);

  add({
    label: 'Dans quel quartier ?', type: 'CHOIX_UNIQUE', syncsToProfile: 'quartier',
    showIf: residentAutreQuartier, options: RESIDENCE_QUARTIERS,
  });
  add({
    label: 'Dans quelle ville ?', type: 'TEXTE_LIBRE', uiHint: 'VILLE_FR', showIf: residentAutreVille,
  });

  // Recette, test 1 : préremplie depuis le profil ET l'y enregistre
  // (oui / non), grâce au champ explicite « travaille à Senlis »
  const qTravaille = add({
    label: 'Travaillez-vous ou dirigez-vous une activité à Senlis ?', type: 'OUI_NON',
    syncsToProfile: 'travailleASenlis',
  });
  const travailleOui = when(qTravaille, 0);

  const qQuartierTravail = add({
    label: 'Dans quel quartier travaillez-vous ?', type: 'CHOIX_UNIQUE', syncsToProfile: 'travailleQuartier',
    showIf: travailleOui, options: TRAVAIL_QUARTIERS,
  });
  const travailleCentre = when(qQuartierTravail, at(TRAVAIL_QUARTIERS, 'Centre historique'));

  add({
    label: 'À ce titre…', type: 'CHOIX_UNIQUE', syncsToProfile: 'travailType', showIf: travailleOui,
    options: [
      { label: 'Je dirige ou gère cette activité', syncValue: 'COMMERCANT' },
      { label: "J'y suis salarié·e", syncValue: 'SALARIE' },
    ],
  });
  const qActivite = add({
    label: "Quel type d'activité (la vôtre, ou celle qui vous emploie) ?",
    helpText: 'Si vous dirigez cette activité, merci de transmettre aussi ce questionnaire à vos salarié·es : leurs réponses comptent autant que les vôtres.',
    type: 'CHOIX_UNIQUE', showIf: travailleOui, options: ACTIVITES,
  });
  // Recette, test 2 : « Autre » → « Laquelle ? »
  add({ label: 'Laquelle ?', type: 'TEXTE_LIBRE', showIf: when(qActivite, at(ACTIVITES, 'Autre activité')) });

  // ══ 2. TRAVAIL DANS LE CENTRE HISTORIQUE ════════════════
  const qVenirTravail = add({
    label: 'Comment venez-vous travailler le plus souvent ?', type: 'CHOIX_UNIQUE',
    showIf: travailleCentre, options: MOBILITES,
  });
  add({
    label: 'Quel autre mode de transport ?', type: 'TEXTE_LIBRE',
    showIf: when(qVenirTravail, at(MOBILITES, 'Autre')),
  });
  const qCovoit = add({
    label: 'Le véhicule de covoiturage se gare-t-il dans le centre historique ?', type: 'OUI_NON',
    showIf: when(qVenirTravail, at(MOBILITES, 'Covoiturage')),
  });
  // OU : en voiture, OU en covoiturage garé dans le centre
  const vientTravailEnVoiture = [when(qVenirTravail, at(MOBILITES, 'Voiture')), when(qCovoit, 0)];
  add({
    label: 'Où garez-vous ce véhicule pendant votre travail ?', type: 'CHOIX_UNIQUE',
    showIfAny: vientTravailEnVoiture, options: STATIONNEMENTS,
  });
  const qDifficultesTravail = add({
    label: 'Rencontrez-vous des difficultés pour vous garer ?', type: 'OUI_NON', showIfAny: vientTravailEnVoiture,
  });
  add({ label: 'Lesquelles ?', type: 'TEXTE_LIBRE', showIf: when(qDifficultesTravail, 0) });
  const qFreinsTravail = add({
    label: 'Quels freins vous empêchent de venir travailler sans voiture ?',
    helpText: "Cochez tout ce qui s'applique.",
    type: 'CHOIX_MULTIPLE', showIf: when(qVenirTravail, at(MOBILITES, 'Voiture')), options: FREINS,
  });
  add({ label: 'Précisez cet autre frein', type: 'TEXTE_LIBRE', showIf: when(qFreinsTravail, at(FREINS, 'Autre frein')) });

  // Véhicules professionnels (recette, test 2)
  const qVehiculesPro = add({
    label: 'Utilisez-vous un ou plusieurs véhicules à des fins professionnelles (livraisons, tournées…) ?',
    type: 'OUI_NON', showIf: travailleCentre,
  });
  const vehiculesProOui = when(qVehiculesPro, 0);
  // « Oui » puis 0 n'a pas de sens : au moins 1
  const qNbPro = add({
    label: 'Combien de véhicules professionnels ?', type: 'NOMBRE', minValue: 1, maxValue: 50, showIf: vehiculesProOui,
  });
  add({
    label: 'Où sont garés ces véhicules professionnels ?',
    helpText: "Cochez tout ce qui s'applique — au plus une case par véhicule.",
    type: 'CHOIX_MULTIPLE', showIf: vehiculesProOui, maxChoicesFrom: { questionOrder: qNbPro }, options: STATIONNEMENTS,
  });
  const qDifficultesPro = add({
    label: 'Rencontrez-vous des difficultés pour garer ces véhicules professionnels ?', type: 'OUI_NON', showIf: vehiculesProOui,
  });
  add({ label: 'Lesquelles ?', type: 'TEXTE_LIBRE', showIf: when(qDifficultesPro, 0) });

  // ══ 3. VENIR DANS LE CENTRE (résident·es d'ailleurs) ═════
  const visiteur = [residentAutreQuartier, residentAutreVille];
  const FREQUENCES_VISITE = [...FREQUENCES, { label: 'Jamais' }];
  const qFrequenceVisite = add({
    label: 'En dehors de votre éventuel travail, à quelle fréquence venez-vous dans le centre historique ?',
    type: 'CHOIX_UNIQUE', showIfAny: visiteur, options: FREQUENCES_VISITE,
  });
  const vientDansLeCentre = FREQUENCES.map((f) => when(qFrequenceVisite, at(FREQUENCES_VISITE, f.label)));
  const qVenirCentre = add({
    label: 'Le plus souvent, comment venez-vous dans le centre historique ?', type: 'CHOIX_UNIQUE',
    showIfAny: vientDansLeCentre, options: MOBILITES,
  });
  add({ label: 'Quel autre mode de transport ?', type: 'TEXTE_LIBRE', showIf: when(qVenirCentre, at(MOBILITES, 'Autre')) });
  const vientEnVoiture = when(qVenirCentre, at(MOBILITES, 'Voiture'));
  add({
    label: 'Où vous garez-vous le plus souvent ?', type: 'CHOIX_UNIQUE', showIf: vientEnVoiture, options: STATIONNEMENTS,
  });
  const qDifficultesVisite = add({
    label: 'Rencontrez-vous des difficultés pour vous garer ?', type: 'OUI_NON', showIf: vientEnVoiture,
  });
  add({ label: 'Lesquelles ?', type: 'TEXTE_LIBRE', showIf: when(qDifficultesVisite, 0) });
  const qFreinsVisite = add({
    label: 'Quels freins vous empêchent de venir sans voiture ?',
    helpText: "Cochez tout ce qui s'applique.",
    type: 'CHOIX_MULTIPLE', showIf: vientEnVoiture, options: FREINS,
  });
  add({ label: 'Précisez cet autre frein', type: 'TEXTE_LIBRE', showIf: when(qFreinsVisite, at(FREINS, 'Autre frein')) });

  // ══ 4. RÉSIDER DANS LE CENTRE — en dernier (fin anticipée) ══
  const qAVehicule = add({
    label: 'Votre foyer possède-t-il un ou plusieurs véhicules motorisés ?',
    // Recette, test 2 : ne pas compter deux fois les véhicules pro
    helpText: "Si vous travaillez à Senlis, ne comptez pas les véhicules liés à votre activité : ils ont leurs propres questions.",
    type: 'OUI_NON', showIf: residentCentre,
    // Recette, test 1 : sans véhicule, l'enquête s'arrête là
    options: [{ label: 'Oui' }, { label: 'Non', endsSurvey: true }],
  });
  const aVehicule = when(qAVehicule, 0);
  const qNbFoyer = add({
    label: 'Combien de véhicules motorisés compte votre foyer ?', type: 'NOMBRE', minValue: 1, maxValue: 20, showIf: aVehicule,
  });
  // Recette, test 1 : obligatoire, et pas plus de cases que de véhicules
  add({
    label: 'Où sont garés vos véhicules ?',
    helpText: "Cochez tout ce qui s'applique — au plus une case par véhicule.",
    type: 'CHOIX_MULTIPLE', showIf: aVehicule, maxChoicesFrom: { questionOrder: qNbFoyer }, options: STATIONNEMENTS,
  });
  const qDifficultesFoyer = add({
    label: 'Rencontrez-vous des difficultés pour vous garer ?', type: 'OUI_NON', showIf: aVehicule,
  });
  add({ label: 'Lesquelles ?', type: 'TEXTE_LIBRE', showIf: when(qDifficultesFoyer, 0) });

  // Recette, test 1 : remplace « Utilisez-vous une voiture pour vos
  // déplacements dans ou vers le centre historique ? »
  const qCirculeCentre = add({
    label: 'Vous arrive-t-il de circuler en voiture dans le centre historique ?', type: 'OUI_NON', showIf: aVehicule,
  });
  const MOTIFS = [
    { label: 'Arrêt minute devant ou près de chez moi (5 minutes au plus) : dépose ou ramassage de courses, de marchandises, d\'une personne…' },
    { label: "Arrêt plus long devant ou près de chez moi (plus de 5 minutes) : meubles ou encombrants, préparation d'un départ en week-end ou en vacances…" },
    { label: 'Autre motif' },
  ];
  const qMotifs = add({
    label: 'Pour quelle(s) raison(s) ?', helpText: "Cochez tout ce qui s'applique.",
    type: 'CHOIX_MULTIPLE', showIf: when(qCirculeCentre, 0), options: MOTIFS,
  });
  add({ label: 'Lequel ?', type: 'TEXTE_LIBRE', showIf: when(qMotifs, at(MOTIFS, 'Autre motif')) });
  add({
    label: 'À quelle fréquence circulez-vous en voiture dans le centre historique ?',
    type: 'CHOIX_UNIQUE', showIf: when(qCirculeCentre, 0), options: FREQUENCES,
  });

  // ══ 5. POUR FINIR (tout le monde) ════════════════════════
  add({
    label: 'Une suggestion pour le stationnement ou les déplacements dans le centre historique ?',
    type: 'TEXTE_LIBRE', required: false,
  });

  return questions;
}

export const PARKING_SURVEY = {
  // Nouveau slug : l'ancienne version (v2) peut rester en base, close,
  // avec ses réponses — on ne mélange jamais deux questionnaires
  // différents dans les mêmes résultats
  slug: 'stationnement-deplacements-centre-historique',
  title: 'Stationnement et déplacements dans le centre historique',
  description:
    "Vos habitudes de déplacement et de stationnement à Senlis nous aident à mieux organiser l'espace public : un centre-ville plus végétalisé, plus piéton, passe par mieux comprendre qui se gare où, et pourquoi. Quelques minutes suffisent — vous ne verrez que les questions qui vous concernent.",
  questions: buildQuestions(),
};
