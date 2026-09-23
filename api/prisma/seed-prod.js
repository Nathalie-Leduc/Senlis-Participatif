// ══════════════════════════════════════════════════════════
// Seed de PRODUCTION — S5-09
//
// À la différence de seed.js (données de démo pour le dev local :
// comptes citoyens fictifs, deuxième proposition/enquête juste pour
// avoir un exemple "clôturé" à l'écran), ce script n'insère QUE le
// contenu réel qui doit exister au lancement du site :
//   - le compte admin (identifiants fournis par variables
//     d'environnement, JAMAIS en dur dans ce fichier)
//   - LA proposition piétonnisation, celle qui sera vraiment
//     soumise au vote des habitants
//   - L'enquête stationnement, celle qui sera vraiment répondue
//
// Aucun citoyen fictif, aucune deuxième enquête "pour l'exemple",
// aucune réponse pré-remplie — une base de production ne doit
// contenir QUE ce que de vrais habitants ont réellement fait.
//
// Lancer avec : npm run seed:prod
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:prod
// ══════════════════════════════════════════════════════════

import prisma from '../src/lib/prisma.js';
import argon2 from 'argon2';

/**
 * Fonction PURE (aucun accès à process.env à l'intérieur) — exportée
 * pour être testable directement, sans avoir à manipuler de vraies
 * variables d'environnement globales dans un test.
 * @returns {string[]} Liste des problèmes trouvés (vide = tout va bien)
 */
export function validateAdminCredentials(email, password) {
  const errors = [];

  if (!email || !password) {
    errors.push('ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis (variables d\'environnement)');
    return errors; // pas la peine de vérifier la longueur d'un mot de passe qui n'existe pas
  }

  // Même règle que le formulaire d'inscription (12 caractères min) —
  // pas question qu'un compte admin réel parte avec un mot de passe
  // plus faible que ce qu'on exige déjà d'un simple citoyen.
  if (password.length < 12) {
    errors.push('ADMIN_PASSWORD doit contenir au moins 12 caractères (même règle qu\'à l\'inscription)');
  }

  return errors;
}

async function main() {
  // ── Compte admin — IDENTIFIANTS PAR VARIABLES D'ENVIRONNEMENT ──
  // Jamais de mot de passe en dur ici, contrairement à seed.js (dev) :
  // ce fichier est amené à être lu par toute personne ayant accès au
  // dépôt — un mot de passe production qui y serait écrit ne serait
  // plus un secret.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const credentialErrors = validateAdminCredentials(adminEmail, adminPassword);
  if (credentialErrors.length > 0) {
    console.error(`❌ Configuration invalide :\n- ${credentialErrors.join('\n- ')}\n\n`
      + 'Exemple :\n   ADMIN_EMAIL=mairie@senlis.fr ADMIN_PASSWORD="..." npm run seed:prod');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      pseudo: 'Mairie de Senlis',
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log(`✅ Admin : ${admin.email} (mot de passe fourni par variable d'environnement, jamais affiché)`);

  // ── La proposition réelle, SEULEMENT si la base est vide ─────
  const existingProposalCount = await prisma.proposal.count();
  if (existingProposalCount > 0) {
    console.log(`ℹ️  ${existingProposalCount} proposition(s) déjà en base — aucune créée.`);
  } else {
    await prisma.proposal.create({
      data: {
        slug: 'pietonnisation-du-centre-historique',
        title: 'Piétonnisation du centre historique le samedi',
        summary: 'Fermer le centre-ville à la circulation chaque samedi, de 10h à 18h.',
        content:
          "Le centre historique de Senlis accueille chaque samedi de nombreux visiteurs et habitants.\n\n"
          + "Cette proposition vise à fermer la circulation automobile du centre-ville le samedi, pour "
          + "favoriser les déplacements à pied, soutenir les commerçants locaux et réduire la pollution sonore.\n\n"
          + "Des études menées dans des villes comparables montrent une hausse de fréquentation des "
          + "commerces de centre-ville lors de journées sans voiture.",
        status: 'PUBLISHED',
        publishedAt: new Date(),
        authorId: admin.id,
        lat: 49.2058,
        lng: 2.5847,
      },
    });

    console.log('✅ Proposition "Piétonnisation du centre historique" créée (PUBLISHED).');
  }

  // ── L'enquête réelle, SEULEMENT si la base est vide ──────────
  const existingSurveyCount = await prisma.survey.count();
  if (existingSurveyCount > 0) {
    console.log(`ℹ️  ${existingSurveyCount} enquête(s) déjà en base — aucune créée.`);
    return;
  }

  // Reconstruite en 4 parcours réels (revue approfondie du besoin :
  // objectif final = végétaliser/rendre piéton le centre historique,
  // donc comprendre PRÉCISÉMENT qui occupe les places de stationnement
  // du centre et pourquoi, sans pour autant allonger le parcours de
  // chaque répondant — chacun ne voit que les questions de SON profil,
  // même si le total ci-dessous semble long sur le papier).
  //
  // showIf référence la POSITION (order) de la question/option qui
  // déclenche l'affichage — les vrais id n'existent pas encore à ce
  // stade, ils ne seront connus qu'après la création (voir la
  // résolution après coup, plus bas).
  //
  // Limite assumée du moteur actuel : pas de répétition "par véhicule"
  // (ex. "véhicule 1 : où ? véhicule 2 : où ?") — on demande combien
  // de véhicules au total, puis QUELS emplacements sont utilisés
  // parmi la liste (choix multiple), sans détail véhicule par
  // véhicule. Une vraie fonctionnalité de "bloc répété" serait un
  // chantier à part, hors de portée de cette révision.
  const PARKING_OPTIONS = [
    { label: 'Box ou parking sur ma propriété / mon commerce' },
    { label: 'Box ou parking en location' },
    { label: 'Parking public gratuit dans le centre-ville' },
    { label: 'Parking payant dans le centre-ville, avec abonnement' },
    { label: 'Parking payant dans le centre-ville, sans abonnement' },
    { label: 'Parking gratuit autour du centre-ville' },
    { label: 'Parking payant autour du centre-ville, avec abonnement' },
    { label: 'Parking payant autour du centre-ville, sans abonnement' },
  ];
  // Libellé et aide communs à chaque question "où sont garés vos
  // véhicules" — plusieurs véhicules peuvent être garés à des
  // endroits différents, d'où le choix multiple plutôt qu'un choix
  // unique (limite assumée du moteur : pas de détail VÉHICULE PAR
  // VÉHICULE, seulement l'ensemble des emplacements utilisés).
  const PARKING_LABEL = 'Où sont garés vos véhicules ?';
  const PARKING_HELP = 'Si vous avez plusieurs véhicules garés à des endroits différents, cochez toutes les cases qui s\'appliquent.';

  const ACTIVITE_OPTIONS = [
    { label: 'Commerce' },
    { label: 'Banque, assurance ou agence (immobilière, voyages...)' },
    { label: 'Cabinet médical ou paramédical' },
    { label: 'Restaurant, bar ou tabac' },
    { label: 'Service municipal (mairie, police...)' },
    { label: 'École' },
    { label: 'Autre activité' },
  ];
  // Index de "Voiture" et "Covoiturage" et "Autre" — utilisés
  // plusieurs fois ci-dessous (patron ET salarié), autant les nommer
  // une fois pour ne pas se tromper de numéro en le recopiant.
  const MOBILITE_OPTIONS = [
    { label: 'TUS (bus gratuit de Senlis)' },
    { label: 'Bus régional' },
    { label: 'Voiture' },
    { label: 'Scooter ou moto' },
    { label: 'Vélo' },
    { label: 'À pied' },
    { label: 'Trottinette' },
    { label: 'Covoiturage' },
    { label: 'Autre' },
  ];
  // Calculés plutôt que codés en dur : ajouter/retirer une option de
  // MOBILITE_OPTIONS ne casse plus rien ailleurs (même principe que
  // AUTRE_VILLE_INDEX juste en dessous).
  const MOBILITE_VOITURE = MOBILITE_OPTIONS.findIndex((o) => o.label === 'Voiture');
  const MOBILITE_COVOITURAGE = MOBILITE_OPTIONS.findIndex((o) => o.label === 'Covoiturage');
  const MOBILITE_AUTRE = MOBILITE_OPTIONS.findIndex((o) => o.label === 'Autre');

  // Les 6 mêmes quartiers IRIS que l'enum Quartier (S5-13) — le
  // questionnaire ne relit pas ce champ de profil directement (une
  // enquête reste indépendante du compte), mais reprend les mêmes
  // libellés pour que les réponses restent comparables au reste du
  // site plutôt que d'inventer une autre liste.
  //
  // ⚠️ "Une autre ville" reste en réponse libre pour l'instant — un
  // vrai sélecteur avec autocomplétion sur la base INSEE (code
  // postal / début du nom de la commune) est une fonctionnalité à
  // part entière (un jeu de données à intégrer + un composant de
  // recherche côté client), pas quelque chose qu'une révision du
  // contenu de l'enquête peut inclure. À discuter comme ticket séparé
  // si cette précision est jugée prioritaire.
  // Les 6 quartiers IRIS (INSEE) de Senlis autres que le centre
  // historique — chacun avec son syncValue (même valeur que l'enum
  // Quartier), pour la question "résidence" qui synchronise le
  // profil (situation=AUTRE_QUARTIER, quartier=<syncValue>).
  const RESIDENCE_QUARTIER_OPTIONS = [
    { label: 'Brichebay', syncValue: 'BRICHEBAY' },
    { label: 'Bon Secours', syncValue: 'BON_SECOURS' },
    { label: "Val d'Aunette - La Gâtelière", syncValue: 'VAL_AUNETTE_GATELIERE' },
    { label: 'Zone industrielle', syncValue: 'ZONE_INDUSTRIELLE' },
    { label: 'Villevert', syncValue: 'VILLEVERT' },
    { label: 'Jardiniers', syncValue: 'JARDINIERS' },
  ];

  // Même liste, mais avec le centre historique en plus — a du sens
  // comme lieu de TRAVAIL (contrairement à la résidence, où
  // Situation.CENTRE_RESIDENT couvre déjà ce cas séparément).
  const TRAVAIL_QUARTIER_OPTIONS = [
    { label: 'Centre historique', syncValue: 'CENTRE_HISTORIQUE' },
    ...RESIDENCE_QUARTIER_OPTIONS,
  ];

  // Réutilisé pour patrons, salariés et visiteurs non-résidents du
  // centre utilisant leur voiture (jamais pour les habitants, déjà
  // dans le centre par définition).
  const FREINS_ACCES_OPTIONS = [
    { label: 'Difficulté de mobilité personnelle (PMR)' },
    { label: 'Le bus gratuit (TUS) ne dessert pas mon secteur' },
    { label: 'Le bus gratuit (TUS) ne passe pas assez souvent' },
    { label: 'Manque de pistes cyclables sécurisées' },
    { label: 'Circulation à vélo trop dangereuse' },
    { label: 'Autre frein' },
  ];
  const FREINS_ACCES_AUTRE_INDEX = FREINS_ACCES_OPTIONS.length - 1;
  const FREINS_ACCES_LABEL = "Quels freins limitent votre accès au centre-ville sans votre voiture ? (cochez tout ce qui s'applique)";

  // Construit dynamiquement : chaque question retient sa PROPRE
  // position via addQuestion() plutôt qu'un numéro tapé à la main —
  // supprimer ou insérer une question ailleurs dans le tableau ne
  // casse plus jamais les showIf des autres.
  const questionsSpec = [];
  function addQuestion(spec) {
    questionsSpec.push(spec);
    return questionsSpec.length - 1;
  }

  // ══ Axe résidence — toujours posé ══
  // Remplace l'ancienne Q0 à 4 profils (habitant/patron/salarié/
  // visiteur) : celle-ci correspond EXACTEMENT aux 3 valeurs de
  // Situation sur le compte, pour que répondre à l'enquête mette
  // aussi à jour le profil (syncsToProfile — revue du besoin).
  const idxResidence = addQuestion({
    label: 'Où résidez-vous ?',
    type: 'CHOIX_UNIQUE',
    required: true,
    syncsToProfile: 'situation',
    options: [
      { label: 'Le centre historique', syncValue: 'CENTRE_RESIDENT' },
      { label: 'Un autre quartier de Senlis', syncValue: 'AUTRE_QUARTIER' },
      { label: 'Une autre ville', syncValue: 'HORS_SENLIS' },
    ],
  });
  const RESIDENCE_CENTRE = 0;
  const RESIDENCE_AUTRE_QUARTIER = 1;
  const RESIDENCE_AUTRE_VILLE = 2;

  addQuestion({
    label: 'Quel quartier ?',
    type: 'CHOIX_UNIQUE',
    required: true,
    syncsToProfile: 'quartier',
    showIf: { questionOrder: idxResidence, optionOrder: RESIDENCE_AUTRE_QUARTIER },
    options: RESIDENCE_QUARTIER_OPTIONS,
  });

  addQuestion({
    // Pas de syncsToProfile ici : le compte ne garde qu'une valeur
    // grossière (HORS_SENLIS) pour ce cas, sans case pour "laquelle" —
    // voir la discussion sur les limites du modèle de compte actuel.
    label: 'Quelle est cette ville ?',
    type: 'TEXTE_LIBRE',
    required: true,
    uiHint: 'VILLE_FR',
    showIf: { questionOrder: idxResidence, optionOrder: RESIDENCE_AUTRE_VILLE },
  });

  // ══ Axe travail — toujours posé, INDÉPENDANT de la résidence ══
  // Une personne peut résider n'importe où et travailler à Senlis,
  // ou l'inverse — d'où deux axes séparés plutôt qu'un seul arbre
  // à 4 branches comme avant (qui ne couvrait pas, par exemple, un
  // salarié résidant hors de Senlis).
  const idxTravaille = addQuestion({
    label: 'Travaillez-vous ou dirigez-vous une activité à Senlis ?',
    type: 'OUI_NON',
    required: true,
    // Sert UNIQUEMENT au préremplissage côté client (jamais à
    // écrire — ses options Oui/Non n'ont pas de syncValue) : si
    // travailleQuartier est déjà connu sur le profil, "Oui" peut être
    // pré-rempli en confiance. "Non" ne peut jamais l'être : un champ
    // vide veut aussi bien dire "jamais demandé" que "a répondu non"
    // — voir EnqueteRepondre.jsx.
    syncsToProfile: 'travailleQuartier',
  });
  const TRAVAILLE_OUI = 0;
  const TRAVAILLE_NON = 1;

  addQuestion({
    label: 'Dans quel quartier travaillez-vous ?',
    type: 'CHOIX_UNIQUE',
    required: true,
    syncsToProfile: 'travailleQuartier',
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_OUI },
    options: TRAVAIL_QUARTIER_OPTIONS,
  });

  addQuestion({
    label: 'À ce titre...',
    type: 'CHOIX_UNIQUE',
    required: true,
    syncsToProfile: 'travailType',
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_OUI },
    options: [
      { label: 'Je dirige/gère cette activité', syncValue: 'COMMERCANT' },
      { label: "J'y suis salarié(e)", syncValue: 'SALARIE' },
    ],
  });

  // ══ Résidents du centre — véhicules du foyer ══
  // Inchangé dans l'esprit par rapport à l'ancienne version : ne
  // concerne que le stationnement AU DOMICILE, dans le centre.
  addQuestion({
    label: 'Combien de véhicules motorisés compte votre foyer ?',
    type: 'NOMBRE',
    required: true,
    showIf: { questionOrder: idxResidence, optionOrder: RESIDENCE_CENTRE },
  });
  addQuestion({
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxResidence, optionOrder: RESIDENCE_CENTRE },
    options: [...PARKING_OPTIONS, { label: "Je n'ai pas de véhicule" }],
  });
  const idxDifficultesFoyer = addQuestion({
    label: 'Rencontrez-vous des difficultés pour vous garer ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxResidence, optionOrder: RESIDENCE_CENTRE },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxDifficultesFoyer, optionOrder: 0 }, // "Oui"
  });

  // ══ Quiconque travaille à Senlis — activité, mobilité, véhicules pro ══
  // Généralisation utile par rapport à l'ancienne version : s'applique
  // à qui travaille à Senlis quel que soit son lieu de RÉSIDENCE (un
  // patron habitant une autre ville était mal couvert avant).
  addQuestion({
    // le helpText porte la consigne aux patrons, quel que soit le
    // type d'activité — inutile pour un salarié, mais sans incidence
    // à ce qu'iel la voie aussi.
    label: "Quel type d'activité (la vôtre, ou celle qui vous emploie) ?",
    helpText: "Si vous dirigez cette activité, merci de transmettre également ce questionnaire à vos salarié(e)s — leurs réponses comptent tout autant que les vôtres.",
    type: 'CHOIX_UNIQUE',
    required: true,
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_OUI },
    options: ACTIVITE_OPTIONS,
  });

  const idxMobiliteTravail = addQuestion({
    label: 'Comment venez-vous travailler le plus souvent ?',
    type: 'CHOIX_UNIQUE',
    required: true,
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_OUI },
    options: MOBILITE_OPTIONS,
  });
  addQuestion({
    label: 'Vous avez répondu "Autre" — précisez ce mode de transport',
    type: 'TEXTE_LIBRE',
    required: true,
    showIf: { questionOrder: idxMobiliteTravail, optionOrder: MOBILITE_AUTRE },
  });
  const idxCovoitTravail = addQuestion({
    label: 'Le véhicule du covoiturage se gare-t-il à Senlis ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxMobiliteTravail, optionOrder: MOBILITE_COVOITURAGE },
  });
  addQuestion({
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxCovoitTravail, optionOrder: 0 }, // "Oui"
    options: PARKING_OPTIONS,
  });
  addQuestion({
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxMobiliteTravail, optionOrder: MOBILITE_VOITURE },
    options: PARKING_OPTIONS,
  });
  const idxDifficultesTravail = addQuestion({
    label: 'Rencontrez-vous des difficultés pour vous garer ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxMobiliteTravail, optionOrder: MOBILITE_VOITURE },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxDifficultesTravail, optionOrder: 0 },
  });
  const idxFreinsTravail = addQuestion({
    label: FREINS_ACCES_LABEL,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxMobiliteTravail, optionOrder: MOBILITE_VOITURE },
    options: FREINS_ACCES_OPTIONS,
  });
  addQuestion({
    label: 'Précisez cet autre frein',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxFreinsTravail, optionOrder: FREINS_ACCES_AUTRE_INDEX },
  });

  const idxVehiculesPro = addQuestion({
    label: 'Utilisez-vous un ou plusieurs véhicules à des fins professionnelles (ex. livraisons) ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_OUI },
  });
  addQuestion({
    label: 'Combien de véhicules professionnels utilisez-vous ?',
    type: 'NOMBRE',
    required: true,
    showIf: { questionOrder: idxVehiculesPro, optionOrder: 0 }, // "Oui"
  });
  addQuestion({
    label: 'Où sont garés ces véhicules professionnels ?',
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxVehiculesPro, optionOrder: 0 },
    options: PARKING_OPTIONS,
  });
  const idxDifficultesPro = addQuestion({
    label: 'Rencontrez-vous des difficultés pour garer ces véhicules professionnels ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxVehiculesPro, optionOrder: 0 },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxDifficultesPro, optionOrder: 0 },
  });

  addQuestion({
    label: 'Une suggestion pour améliorer le stationnement lié à votre activité ou votre travail ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_OUI },
  });

  // ══ Ne travaille pas à Senlis — usage et accès au centre ══
  // Reste posé même à un·e résident·e du centre qui ne travaille pas
  // à Senlis (léger chevauchement avec le bloc "véhicules du foyer"
  // ci-dessus, assumé — le moteur ne gère qu'UNE condition par
  // question, pas de "ET" entre deux questions différentes).
  const idxVientVoiture = addQuestion({
    label: 'Utilisez-vous une voiture pour vos déplacements dans ou vers le centre historique ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_NON },
  });
  addQuestion({
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxVientVoiture, optionOrder: 0 }, // "Oui"
    options: PARKING_OPTIONS,
  });
  const idxDifficultesVisiteur = addQuestion({
    label: 'Rencontrez-vous des difficultés pour vous garer ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxVientVoiture, optionOrder: 0 },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxDifficultesVisiteur, optionOrder: 0 },
  });
  const idxFreinsVisiteur = addQuestion({
    label: FREINS_ACCES_LABEL,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxVientVoiture, optionOrder: 0 },
    options: FREINS_ACCES_OPTIONS,
  });
  addQuestion({
    label: 'Précisez cet autre frein',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxFreinsVisiteur, optionOrder: FREINS_ACCES_AUTRE_INDEX },
  });
  addQuestion({
    label: 'À quelle fréquence venez-vous dans le centre-ville ?',
    type: 'CHOIX_UNIQUE',
    required: false,
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_NON },
    options: [
      { label: 'Tous les jours' },
      { label: 'Plusieurs fois par semaine' },
      { label: 'Occasionnellement' },
      { label: 'Jamais' },
    ],
  });
  addQuestion({
    label: 'Une suggestion pour rendre vos visites au centre-ville plus agréables ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxTravaille, optionOrder: TRAVAILLE_NON },
  });
  // $transaction : création ET résolution du branchement doivent
  // réussir ENSEMBLE — un crash entre les deux laisserait une
  // enquête avec des questions mais un branchement à moitié posé
  // (même principe que resolveBranching côté contrôleur admin).
  await prisma.$transaction(async (tx) => {
    const survey = await tx.survey.create({
      data: {
        slug: 'stationnement-centre-historique',
        title: 'Stationnement et déplacements dans le centre historique',
        description:
          'Vos habitudes de déplacement et de stationnement à Senlis nous aident à mieux organiser l\'espace public — un centre-ville plus végétalisé, plus piéton, passe par mieux comprendre qui se gare où, et pourquoi.',
        status: 'OPEN',
        opensAt: new Date(),
        questions: {
          create: questionsSpec.map((q, index) => {
            // Même logique que toNestedQuestionsCreate côté contrôleur
            // admin : une question OUI_NON sans options explicites
            // reçoit "Oui"/"Non" par défaut — sans ce filet, une
            // question OUI_NON écrite sans `options` (le cas courant,
            // pour rester lisible) n'aurait AUCUNE option en base, et
            // toute question qui en dépend (showIf) n'aurait rien à
            // référencer.
            const options = q.options
              ?? (q.type === 'OUI_NON' ? [{ label: 'Oui' }, { label: 'Non' }] : undefined);

            return {
              label: q.label,
              helpText: q.helpText,
              type: q.type,
              required: q.required,
              order: index,
              uiHint: q.uiHint,
              syncsToProfile: q.syncsToProfile,
              options: options
                ? { create: options.map((o, optionIndex) => ({ label: o.label, order: optionIndex, syncValue: o.syncValue })) }
                : undefined,
            };
          }),
        },
      },
    });

    const createdQuestions = await tx.question.findMany({
      where: { surveyId: survey.id },
      include: { options: true },
      orderBy: { order: 'asc' },
    });

    for (const [index, spec] of questionsSpec.entries()) {
      if (!spec.showIf) continue;

      const targetQuestion = createdQuestions.find((q) => q.order === spec.showIf.questionOrder);
      const targetOption = targetQuestion?.options.find((o) => o.order === spec.showIf.optionOrder);

      await tx.question.update({
        where: { id: createdQuestions[index].id },
        data: { showIfOptionId: targetOption.id },
      });
    }
  });

  console.log('✅ Enquête "Stationnement et déplacements dans le centre historique" créée (OPEN), en 4 parcours branchés.');
}

// N'exécute main() QUE si ce fichier est lancé directement
// (node prisma/seed-prod.js ou npm run seed:prod), jamais quand il
// est simplement IMPORTÉ pour ses exports — les tests importent
// validateAdminCredentials() sans vouloir déclencher tout le seed.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((err) => {
      console.error('❌ Erreur pendant le seed de production :', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
