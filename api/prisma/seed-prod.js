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
  const ACTIVITE_OPTIONS = [
    { label: 'Commerce' },
    { label: 'Banque, assurance ou agence (immobilière, voyages...)' },
    { label: 'Cabinet médical ou paramédical' },
    { label: 'Restaurant, bar ou tabac' },
    { label: 'Service municipal (mairie, police...)' },
    { label: 'École' },
    { label: 'Autre activité' },
  ];
  const MOBILITE_OPTIONS = [
    { label: 'TUS (bus gratuit de Senlis)' },
    { label: 'Bus régional' },
    { label: 'Voiture' },
    { label: 'Vélo' },
    { label: 'À pied' },
    { label: 'Trottinette' },
    { label: 'Covoiturage' },
    { label: 'Autre' },
  ];
  // Les 6 mêmes quartiers IRIS que l'enum Quartier (S5-13) — le
  // questionnaire ne relit pas ce champ de profil directement (une
  // enquête reste indépendante du compte), mais reprend les mêmes
  // libellés pour que les réponses restent comparables au reste du
  // site plutôt que d'inventer une autre liste.
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

  const questionsSpec = [
    {
      // order 0 — l'aiguillage principal, 4 profils bien distincts
      label: 'Quel est votre lien avec le centre historique ?',
      type: 'CHOIX_UNIQUE',
      required: true,
      options: [
        { label: "J'habite dans le centre historique" },
        { label: 'Je dirige/gère une activité du centre historique (commerce, profession libérale, service...)' },
        { label: "Je suis salarié(e) d'une activité du centre historique" },
        { label: "Je ne vis ni ne travaille dans le centre historique, mais j'y viens parfois" },
      ],
    },

    // ══ Parcours A — habitants du centre (showIf 0→option 0) ══
    {
      label: 'Combien de véhicules motorisés compte votre foyer ?',
      type: 'NOMBRE',
      required: true,
      showIf: { questionOrder: 0, optionOrder: 0 },
    },
    {
      label: 'Où sont garés vos véhicules ? (cochez tout ce qui s\'applique)',
      type: 'CHOIX_MULTIPLE',
      required: false,
      showIf: { questionOrder: 0, optionOrder: 0 },
      options: [...PARKING_OPTIONS, { label: "Je n'ai pas de véhicule" }],
    },
    {
      label: 'Quels freins limitent votre usage du vélo pour vos déplacements quotidiens ?',
      type: 'CHOIX_MULTIPLE',
      required: false,
      showIf: { questionOrder: 0, optionOrder: 0 },
      options: [
        { label: 'Manque de pistes cyclables' },
        { label: 'Sécurité routière' },
        { label: 'Relief / distance' },
        { label: 'Aucun frein particulier' },
      ],
    },
    {
      label: 'Une suggestion pour améliorer le cadre de vie dans le centre-ville ?',
      type: 'TEXTE_LIBRE',
      required: false,
      showIf: { questionOrder: 0, optionOrder: 0 },
    },

    // ══ Parcours B — patrons/gérants d'une activité (showIf 0→option 1) ══
    {
      // order 5 — le helpText porte la consigne demandée, visible
      // uniquement dans CE parcours (pas pour les habitants/visiteurs
      // pour qui ça n'a pas de sens).
      label: "Quel type d'activité dirigez-vous ?",
      helpText: "Merci de transmettre également ce questionnaire à vos salarié(e)s — leurs réponses comptent tout autant que les vôtres pour bien comprendre le stationnement au centre-ville.",
      type: 'CHOIX_UNIQUE',
      required: true,
      showIf: { questionOrder: 0, optionOrder: 1 },
      options: ACTIVITE_OPTIONS,
    },
    {
      // order 6 — un OUI_NON simple comme porte d'entrée : évite le
      // problème "dépend de l'option A OU B" (le moteur ne gère
      // qu'UNE option déclenchante par question) en ne posant qu'UNE
      // question binaire, dont "Non" ouvre ensuite tout le reste.
      label: 'Résidez-vous dans le centre historique ?',
      type: 'OUI_NON',
      required: true,
      showIf: { questionOrder: 0, optionOrder: 1 },
    },
    {
      label: "D'où venez-vous ?",
      type: 'CHOIX_UNIQUE',
      required: true,
      showIf: { questionOrder: 6, optionOrder: 1 }, // "Non" à la question précédente
      options: QUARTIER_OU_VILLE_OPTIONS,
    },
    {
      label: 'Quelle est cette ville ?',
      type: 'TEXTE_LIBRE',
      required: true,
      showIf: { questionOrder: 7, optionOrder: AUTRE_VILLE_INDEX },
    },
    {
      label: 'Comment venez-vous travailler le plus souvent ?',
      type: 'CHOIX_UNIQUE',
      required: true,
      showIf: { questionOrder: 6, optionOrder: 1 },
      options: MOBILITE_OPTIONS,
    },
    {
      // order 10 — dépend de la RÉPONSE "Voiture" à la question de
      // mobilité juste avant (chaînage sur 2 niveaux, comme au ticket
      // S5-17 précédent).
      label: 'Où garez-vous votre véhicule ? (cochez tout ce qui s\'applique)',
      type: 'CHOIX_MULTIPLE',
      required: false,
      showIf: { questionOrder: 9, optionOrder: 2 }, // "Voiture"
      options: PARKING_OPTIONS,
    },
    {
      label: 'Utilisez-vous un ou plusieurs véhicules à des fins professionnelles (ex. livraisons) ?',
      type: 'OUI_NON',
      required: true,
      showIf: { questionOrder: 0, optionOrder: 1 },
    },
    {
      label: 'Combien de véhicules professionnels utilisez-vous ?',
      type: 'NOMBRE',
      required: true,
      showIf: { questionOrder: 11, optionOrder: 0 }, // "Oui"
    },
    {
      label: 'Où sont garés ces véhicules professionnels ? (cochez tout ce qui s\'applique)',
      type: 'CHOIX_MULTIPLE',
      required: false,
      showIf: { questionOrder: 11, optionOrder: 0 },
      options: PARKING_OPTIONS,
    },
    {
      label: 'Une suggestion pour améliorer le stationnement autour de votre activité ?',
      type: 'TEXTE_LIBRE',
      required: false,
      showIf: { questionOrder: 0, optionOrder: 1 },
    },

    // ══ Parcours C — salarié(e)s d'une activité (showIf 0→option 2) ══
    // Même structure que le parcours B, sans le volet véhicules
    // professionnels (ressource de l'activité, pas du salarié).
    {
      label: 'Dans quel type d\'activité travaillez-vous ?',
      type: 'CHOIX_UNIQUE',
      required: true,
      showIf: { questionOrder: 0, optionOrder: 2 },
      options: ACTIVITE_OPTIONS,
    },
    {
      label: 'Résidez-vous dans le centre historique ?',
      type: 'OUI_NON',
      required: true,
      showIf: { questionOrder: 0, optionOrder: 2 },
    },
    {
      label: "D'où venez-vous ?",
      type: 'CHOIX_UNIQUE',
      required: true,
      showIf: { questionOrder: 16, optionOrder: 1 },
      options: QUARTIER_OU_VILLE_OPTIONS,
    },
    {
      label: 'Quelle est cette ville ?',
      type: 'TEXTE_LIBRE',
      required: true,
      showIf: { questionOrder: 17, optionOrder: AUTRE_VILLE_INDEX },
    },
    {
      label: 'Comment venez-vous travailler le plus souvent ?',
      type: 'CHOIX_UNIQUE',
      required: true,
      showIf: { questionOrder: 16, optionOrder: 1 },
      options: MOBILITE_OPTIONS,
    },
    {
      label: 'Où garez-vous votre véhicule ? (cochez tout ce qui s\'applique)',
      type: 'CHOIX_MULTIPLE',
      required: false,
      showIf: { questionOrder: 19, optionOrder: 2 }, // "Voiture"
      options: PARKING_OPTIONS,
    },
    {
      label: 'Une suggestion pour améliorer votre trajet domicile-travail ?',
      type: 'TEXTE_LIBRE',
      required: false,
      showIf: { questionOrder: 0, optionOrder: 2 },
    },

    // ══ Parcours D — visiteurs occasionnels (showIf 0→option 3) ══
    {
      label: 'Vous arrive-t-il de venir en voiture dans le centre historique ?',
      type: 'OUI_NON',
      required: true,
      showIf: { questionOrder: 0, optionOrder: 3 },
    },
    {
      label: 'Où vous garez-vous le plus souvent lors de ces visites ? (cochez tout ce qui s\'applique)',
      type: 'CHOIX_MULTIPLE',
      required: false,
      showIf: { questionOrder: 22, optionOrder: 0 }, // "Oui"
      options: PARKING_OPTIONS,
    },
    {
      label: 'À quelle fréquence venez-vous dans le centre-ville ?',
      type: 'CHOIX_UNIQUE',
      required: false,
      showIf: { questionOrder: 0, optionOrder: 3 },
      options: [
        { label: 'Tous les jours' },
        { label: 'Plusieurs fois par semaine' },
        { label: 'Occasionnellement' },
        { label: 'Jamais' },
      ],
    },
    {
      label: 'Une suggestion pour rendre vos visites au centre-ville plus agréables ?',
      type: 'TEXTE_LIBRE',
      required: false,
      showIf: { questionOrder: 0, optionOrder: 3 },
    },
  ];

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
