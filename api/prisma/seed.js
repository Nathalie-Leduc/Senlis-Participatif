// ══════════════════════════════════════════════════════════
// Seed — données de démonstration pour le développement local
//
// À quoi ça sert : remplir ta base de DEV avec un compte admin
// et quelques propositions "prêtes à l'emploi", pour tester
// l'app sans repasser par tout le parcours d'inscription à
// chaque fois.
//
// Lancer avec : npm run seed
//
// Analogie : c'est le décor qu'un metteur en scène installe
// avant la répétition — pas le vrai spectacle (tes vraies
// données de production plus tard), juste de quoi répéter dans
// des conditions réalistes.
//
// ⚠️ Ne JAMAIS lancer ce script contre une base de production —
// il crée un compte admin avec un mot de passe connu de tous
// ceux qui lisent ce fichier (dont ce commentaire !).
// ══════════════════════════════════════════════════════════

// On réutilise le même singleton que le reste de l'API (lib/prisma.js)
// plutôt que d'instancier un PrismaClient à part : depuis Prisma 7,
// créer un client demande un adapter (voir lib/prisma.js) — pas la
// peine de dupliquer cette logique ici pour un script ponctuel.
import prisma from '../src/lib/prisma.js';
import argon2 from 'argon2';

async function main() {
  // ── Un compte admin, réutilisable à volonté ──────────────
  // upsert = "crée s'il n'existe pas encore, sinon ne touche à
  // rien" — relancer "npm run seed" plusieurs fois de suite ne
  // créera jamais deux admins en double avec le même email.
  const passwordHash = await argon2.hash('MotDePasse123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@senlis-participatif.fr' },
    update: {},
    create: {
      email: 'admin@senlis-participatif.fr',
      pseudo: 'AdminSenlis',
      passwordHash,
      role: 'ADMIN',
      emailVerified: true, // pas besoin de re-vérifier un compte de dev
    },
  });

  console.log(`✅ Admin : ${admin.email} / mot de passe : MotDePasse123!`);

  // ── Plusieurs comptes citoyens, email déjà vérifié ───────
  // Même mot de passe que l'admin, réutilisé pour aller vite en
  // dev — upsert : relancer "npm run seed" plusieurs fois ne
  // crée jamais de doublons, comme pour l'admin ci-dessus.
  const citizensData = [
    { email: 'alice@senlis-test.fr', pseudo: 'AliceD' },
    { email: 'bruno@senlis-test.fr', pseudo: 'BrunoM' },
    { email: 'claire@senlis-test.fr', pseudo: 'ClaireP' },
    { email: 'david@senlis-test.fr', pseudo: 'DavidR' },
  ];

  const citizens = [];
  for (const c of citizensData) {
    const citizen = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        pseudo: c.pseudo,
        passwordHash,
        role: 'CITIZEN',
        emailVerified: true, // pas besoin de re-vérifier un compte de dev
      },
    });
    citizens.push(citizen);
  }

  console.log(`✅ ${citizens.length} comptes citoyens (email déjà vérifié) / mot de passe : MotDePasse123!`);

  // ── Quelques propositions, SEULEMENT si la base est vide ──
  // On évite d'empiler des doublons à chaque "npm run seed".
  //
  // if/else plutôt qu'un early return : un return ici arrêterait
  // TOUTE la fonction, y compris la création des enquêtes plus bas —
  // exactement le bug qui a fait disparaître le seed des enquêtes la
  // première fois que ce fichier a été relancé sur une base qui avait
  // déjà des propositions.
  const existingCount = await prisma.proposal.count();
  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} proposition(s) déjà en base — aucune créée.`);
  } else {
    await prisma.proposal.create({
      data: {
        slug: 'pietonnisation-du-centre-historique',
        title: 'Piétonnisation du centre historique le samedi',
        summary: 'Fermer le centre-ville à la circulation chaque samedi, de 10h à 18h.',
        content:
          "Le centre historique de Senlis accueille chaque samedi de nombreux visiteurs et habitants.\n\n" +
          "Cette proposition vise à fermer la circulation automobile du centre-ville le samedi, pour " +
          "favoriser les déplacements à pied, soutenir les commerçants locaux et réduire la pollution sonore.\n\n" +
          "Des études menées dans des villes comparables montrent une hausse de fréquentation des " +
          "commerces de centre-ville lors de journées sans voiture.",
        status: 'PUBLISHED', // → visible tout de suite sur /propositions
        publishedAt: new Date(),
        authorId: admin.id,
        lat: 49.2058,
        lng: 2.5847,
      },
    });

    await prisma.proposal.create({
      data: {
        slug: 'eclairage-public-rue-de-la-republique',
        title: 'Éclairage public rue de la République',
        summary: "Renforcer l'éclairage public le long de la rue de la République.",
        content:
          "Plusieurs riverains signalent un éclairage insuffisant en soirée sur cette rue très fréquentée.\n\n" +
          "Cette proposition demande l'installation de lampadaires supplémentaires, à énergie solaire " +
          "si possible, pour améliorer la sécurité des piétons.",
        status: 'CLOSED', // → pour tester l'affichage "votes clos"
        publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // il y a 30 jours
        closesAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // clôturée il y a 2 jours
        authorId: admin.id,
      },
    });

    console.log('✅ 2 propositions de démonstration créées (1 PUBLISHED, 1 CLOSED).');
  }

  // ── Deux enquêtes, SEULEMENT si la base est vide ─────────
  const existingSurveyCount = await prisma.survey.count();
  if (existingSurveyCount > 0) {
    console.log(`ℹ️  ${existingSurveyCount} enquête(s) déjà en base — aucune créée.`);
    return;
  }

  await prisma.survey.create({
    data: {
      slug: 'stationnement-centre-historique',
      title: 'Stationnement et déplacements dans le centre historique',
      description:
        'Vos habitudes de déplacement et de stationnement à Senlis nous aident à mieux organiser l\'espace public.',
      status: 'OPEN', // → répondable tout de suite sur /enquetes
      opensAt: new Date(),
      questions: {
        create: [
          {
            label: 'Vous arrive-t-il de circuler en voiture dans le centre historique ?',
            type: 'OUI_NON',
            required: true,
            order: 0,
            options: { create: [{ label: 'Oui', order: 0 }, { label: 'Non', order: 1 }] },
          },
          {
            label: 'Où vous garez-vous le plus souvent ?',
            type: 'CHOIX_UNIQUE',
            required: true,
            order: 1,
            options: {
              create: [
                { label: 'Parking de la mairie', order: 0 },
                { label: 'Voirie payante', order: 1 },
                { label: 'Parking gratuit en périphérie', order: 2 },
                { label: 'Je ne me gare jamais en centre-ville', order: 3 },
              ],
            },
          },
          {
            label: 'Quels freins limitent votre usage du vélo en ville ?',
            type: 'CHOIX_MULTIPLE',
            required: false,
            order: 2,
            options: {
              create: [
                { label: 'Manque de pistes cyclables', order: 0 },
                { label: 'Sécurité routière', order: 1 },
                { label: 'Relief / distance', order: 2 },
                { label: 'Aucun frein particulier', order: 3 },
              ],
            },
          },
          {
            label: 'Combien de véhicules motorisés compte votre foyer ?',
            type: 'NOMBRE',
            required: true,
            order: 3,
          },
          {
            label: 'Une suggestion pour améliorer le stationnement en centre-ville ?',
            type: 'TEXTE_LIBRE',
            required: false,
            order: 4,
          },
        ],
      },
    },
  });

  // Deuxième enquête, CLOSED cette fois — pour avoir un exemple
  // de page résultats avec de vraies données, pas juste des zéros
  // partout (voir les réponses déposées juste après).
  const horaires = await prisma.survey.create({
    data: {
      slug: 'horaires-ouverture-commerces',
      title: "Horaires d'ouverture des commerces du centre-ville",
      description:
        "Une consultation menée en amont d'une réflexion municipale sur l'harmonisation des horaires.",
      status: 'CLOSED',
      opensAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      closesAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      questions: {
        create: [
          {
            label: 'Seriez-vous favorable à une ouverture des commerces le dimanche matin ?',
            type: 'OUI_NON',
            required: true,
            order: 0,
            options: { create: [{ label: 'Oui', order: 0 }, { label: 'Non', order: 1 }] },
          },
          {
            label: 'À quelle fréquence faites-vous vos courses en centre-ville ?',
            type: 'CHOIX_UNIQUE',
            required: true,
            order: 1,
            options: {
              create: [
                { label: 'Tous les jours', order: 0 },
                { label: 'Plusieurs fois par semaine', order: 1 },
                { label: 'Occasionnellement', order: 2 },
              ],
            },
          },
        ],
      },
    },
    include: { questions: { include: { options: true } } },
  });

  console.log('✅ 2 enquêtes de démonstration créées (1 OPEN, 1 CLOSED).');

  // ── Quelques réponses déjà déposées sur l'enquête clôturée ──
  const [oui, non] = horaires.questions[0].options;
  const [tousLesJours, plusieursFoisSemaine, occasionnellement] = horaires.questions[1].options;

  const reponsesDemo = [
    { citizen: citizens[0], choix1: oui.id, choix2: tousLesJours.id },
    { citizen: citizens[1], choix1: oui.id, choix2: plusieursFoisSemaine.id },
    { citizen: citizens[2], choix1: non.id, choix2: occasionnellement.id },
  ];

  for (const reponse of reponsesDemo) {
    await prisma.surveyResponse.create({
      data: {
        surveyId: horaires.id,
        userId: reponse.citizen.id,
        answers: {
          create: [
            { questionId: horaires.questions[0].id, optionId: reponse.choix1 },
            { questionId: horaires.questions[1].id, optionId: reponse.choix2 },
          ],
        },
      },
    });
  }

  console.log(`✅ ${reponsesDemo.length} réponse(s) de démonstration déposée(s) sur l'enquête clôturée.`);
}

main()
  .catch((err) => {
    console.error('❌ Erreur pendant le seed :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());