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
  const QUARTIER_OU_VILLE_OPTIONS = [
    { label: 'Brichebay' },
    { label: 'Bon Secours' },
    { label: "Val d'Aunette - La Gâtelière" },
    { label: 'Zone industrielle' },
    { label: 'Villevert' },
    { label: 'Jardiniers' },
    { label: 'Une autre ville' }, // dernier index — référencé plus bas
  ];
  const AUTRE_VILLE_INDEX = QUARTIER_OU_VILLE_OPTIONS.length - 1;

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
  // casse plus jamais les showIf des autres (c'est exactement ce
  // qu'une modification manuelle avait cassé par le passé : décaler
  // une position sans mettre à jour les références qui pointaient
  // dessus).
  const questionsSpec = [];
  function addQuestion(spec) {
    questionsSpec.push(spec);
    return questionsSpec.length - 1; // la position de CETTE question
  }

  // order 0 — l'aiguillage principal, 4 profils bien distincts
  const idxQ0 = addQuestion({
    label: 'Quel est votre lien avec le centre historique ?',
    type: 'CHOIX_UNIQUE',
    required: true,
    options: [
      { label: "J'habite dans le centre historique" },
      { label: 'Je dirige/gère une activité du centre historique (commerce, profession libérale, service...)' },
      { label: "Je suis salarié(e) d'une activité du centre historique" },
      { label: "Je ne vis ni ne travaille dans le centre historique, mais j'y viens parfois" },
    ],
  });

  // ══ Parcours A — habitants du centre (showIf Q0→option 0) ══
  // Pas de question sur les freins au vélo : déjà dans le centre,
  // la question n'a pas de sens pour ce profil.
  const idxA1 = addQuestion({
    label: 'Combien de véhicules motorisés compte votre foyer ?',
    type: 'NOMBRE',
    required: true,
    showIf: { questionOrder: idxQ0, optionOrder: 0 },
  });
  addQuestion({
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxQ0, optionOrder: 0 },
    options: [...PARKING_OPTIONS, { label: "Je n'ai pas de véhicule" }],
  });
  const idxA3 = addQuestion({
    label: 'Rencontrez-vous des difficultés pour vous garer ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxQ0, optionOrder: 0 },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxA3, optionOrder: 0 }, // "Oui"
  });

  // ══ Parcours B — patrons/gérants d'une activité (showIf Q0→option 1) ══
  addQuestion({
    // le helpText porte la consigne demandée aux patrons, visible
    // uniquement dans CE parcours.
    label: "Quel type d'activité dirigez-vous ?",
    helpText: "Merci de transmettre également ce questionnaire à vos salarié(e)s — leurs réponses comptent tout autant que les vôtres pour bien comprendre le stationnement au centre-ville.",
    type: 'CHOIX_UNIQUE',
    required: true,
    showIf: { questionOrder: idxQ0, optionOrder: 1 },
    options: ACTIVITE_OPTIONS,
  });
  const idxB2 = addQuestion({
    // un OUI_NON simple comme porte d'entrée : évite le problème
    // "dépend de l'option A OU B" (le moteur ne gère qu'UNE option
    // déclenchante par question).
    label: 'Résidez-vous dans le centre historique ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxQ0, optionOrder: 1 },
  });
  const idxB3 = addQuestion({
    label: "D'où venez-vous ?",
    type: 'CHOIX_UNIQUE',
    required: true,
    showIf: { questionOrder: idxB2, optionOrder: 1 }, // "Non"
    options: QUARTIER_OU_VILLE_OPTIONS,
  });
  addQuestion({
    label: 'Quelle est cette ville ?',
    type: 'TEXTE_LIBRE',
    required: true,
    showIf: { questionOrder: idxB3, optionOrder: AUTRE_VILLE_INDEX },
  });
  const idxB5 = addQuestion({
    label: 'Comment venez-vous travailler le plus souvent ?',
    type: 'CHOIX_UNIQUE',
    required: true,
    showIf: { questionOrder: idxB2, optionOrder: 1 },
    options: MOBILITE_OPTIONS,
  });
  addQuestion({
    label: 'Vous avez répondu "Autre" — précisez ce mode de transport',
    type: 'TEXTE_LIBRE',
    required: true,
    showIf: { questionOrder: idxB5, optionOrder: MOBILITE_AUTRE },
  });
  const idxB5c = addQuestion({
    label: 'Le véhicule du covoiturage se gare-t-il à Senlis ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxB5, optionOrder: MOBILITE_COVOITURAGE },
  });
  addQuestion({
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxB5c, optionOrder: 0 }, // "Oui"
    options: PARKING_OPTIONS,
  });
  addQuestion({
    // dépend de la RÉPONSE "Voiture" à la question de mobilité,
    // chaînage sur 2 niveaux.
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxB5, optionOrder: MOBILITE_VOITURE },
    options: PARKING_OPTIONS,
  });
  const idxB6b = addQuestion({
    label: 'Rencontrez-vous des difficultés pour vous garer ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxB5, optionOrder: MOBILITE_VOITURE },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxB6b, optionOrder: 0 }, // "Oui"
  });
  const idxB6d = addQuestion({
    label: FREINS_ACCES_LABEL,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxB5, optionOrder: MOBILITE_VOITURE },
    options: FREINS_ACCES_OPTIONS,
  });
  addQuestion({
    label: 'Précisez cet autre frein',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxB6d, optionOrder: FREINS_ACCES_AUTRE_INDEX },
  });
  const idxB7 = addQuestion({
    label: 'Utilisez-vous un ou plusieurs véhicules à des fins professionnelles (ex. livraisons) ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxQ0, optionOrder: 1 },
  });
  addQuestion({
    label: 'Combien de véhicules professionnels utilisez-vous ?',
    type: 'NOMBRE',
    required: true,
    showIf: { questionOrder: idxB7, optionOrder: 0 }, // "Oui"
  });
  addQuestion({
    label: 'Où sont garés ces véhicules professionnels ?',
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxB7, optionOrder: 0 },
    options: PARKING_OPTIONS,
  });
  const idxB9b = addQuestion({
    label: 'Rencontrez-vous des difficultés pour garer ces véhicules professionnels ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxB7, optionOrder: 0 },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxB9b, optionOrder: 0 }, // "Oui"
  });
  addQuestion({
    label: 'Une suggestion pour améliorer le stationnement autour de votre activité ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxQ0, optionOrder: 1 },
  });

  // ══ Parcours C — salarié(e)s d'une activité (showIf Q0→option 2) ══
  // Même structure que le parcours B, sans le volet véhicules
  // professionnels (ressource de l'activité, pas du salarié).
  addQuestion({
    label: "Dans quel type d'activité travaillez-vous ?",
    type: 'CHOIX_UNIQUE',
    required: true,
    showIf: { questionOrder: idxQ0, optionOrder: 2 },
    options: ACTIVITE_OPTIONS,
  });
  const idxC2 = addQuestion({
    label: 'Résidez-vous dans le centre historique ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxQ0, optionOrder: 2 },
  });
  const idxC3 = addQuestion({
    label: "D'où venez-vous ?",
    type: 'CHOIX_UNIQUE',
    required: true,
    showIf: { questionOrder: idxC2, optionOrder: 1 },
    options: QUARTIER_OU_VILLE_OPTIONS,
  });
  addQuestion({
    label: 'Quelle est cette ville ?',
    type: 'TEXTE_LIBRE',
    required: true,
    showIf: { questionOrder: idxC3, optionOrder: AUTRE_VILLE_INDEX },
  });
  const idxC5 = addQuestion({
    label: 'Comment venez-vous travailler le plus souvent ?',
    type: 'CHOIX_UNIQUE',
    required: true,
    showIf: { questionOrder: idxC2, optionOrder: 1 },
    options: MOBILITE_OPTIONS,
  });
  addQuestion({
    label: 'Vous avez répondu "Autre" — précisez ce mode de transport',
    type: 'TEXTE_LIBRE',
    required: true,
    showIf: { questionOrder: idxC5, optionOrder: MOBILITE_AUTRE },
  });
  const idxC5c = addQuestion({
    label: 'Le véhicule du covoiturage se gare-t-il à Senlis ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxC5, optionOrder: MOBILITE_COVOITURAGE },
  });
  addQuestion({
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxC5c, optionOrder: 0 },
    options: PARKING_OPTIONS,
  });
  addQuestion({
    label: PARKING_LABEL,
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxC5, optionOrder: MOBILITE_VOITURE },
    options: PARKING_OPTIONS,
  });
  const idxC6b = addQuestion({
    label: 'Rencontrez-vous des difficultés pour vous garer ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxC5, optionOrder: MOBILITE_VOITURE },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxC6b, optionOrder: 0 },
  });
  const idxC6d = addQuestion({
    label: FREINS_ACCES_LABEL,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxC5, optionOrder: MOBILITE_VOITURE },
    options: FREINS_ACCES_OPTIONS,
  });
  addQuestion({
    label: 'Précisez cet autre frein',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxC6d, optionOrder: FREINS_ACCES_AUTRE_INDEX },
  });
  addQuestion({
    label: 'Une suggestion pour améliorer votre trajet domicile-travail ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxQ0, optionOrder: 2 },
  });

  // ══ Parcours D — visiteurs occasionnels (showIf Q0→option 3) ══
  const idxD1 = addQuestion({
    label: 'Vous arrive-t-il de venir en voiture dans le centre historique ?',
    type: 'OUI_NON',
    required: true,
    showIf: { questionOrder: idxQ0, optionOrder: 3 },
  });
  addQuestion({
    label: PARKING_LABEL + ' lors de ces visites ?',
    helpText: PARKING_HELP,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxD1, optionOrder: 0 }, // "Oui"
    options: PARKING_OPTIONS,
  });
  const idxD2b = addQuestion({
    label: 'Rencontrez-vous des difficultés pour vous garer ?',
    type: 'OUI_NON',
    required: false,
    showIf: { questionOrder: idxD1, optionOrder: 0 },
  });
  addQuestion({
    label: 'Lesquelles ?',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxD2b, optionOrder: 0 },
  });
  const idxD2d = addQuestion({
    label: FREINS_ACCES_LABEL,
    type: 'CHOIX_MULTIPLE',
    required: false,
    showIf: { questionOrder: idxD1, optionOrder: 0 },
    options: FREINS_ACCES_OPTIONS,
  });
  addQuestion({
    label: 'Précisez cet autre frein',
    type: 'TEXTE_LIBRE',
    required: false,
    showIf: { questionOrder: idxD2d, optionOrder: FREINS_ACCES_AUTRE_INDEX },
  });
  addQuestion({
    label: 'À quelle fréquence venez-vous dans le centre-ville ?',
    type: 'CHOIX_UNIQUE',
    required: false,
    showIf: { questionOrder: idxQ0, optionOrder: 3 },
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
    showIf: { questionOrder: idxQ0, optionOrder: 3 },
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
              options: options
                ? { create: options.map((o, optionIndex) => ({ label: o.label, order: optionIndex })) }
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
