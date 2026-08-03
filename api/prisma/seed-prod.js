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

  await prisma.survey.create({
    data: {
      slug: 'stationnement-centre-historique',
      title: 'Stationnement et déplacements dans le centre historique',
      description:
        'Vos habitudes de déplacement et de stationnement à Senlis nous aident à mieux organiser l\'espace public.',
      status: 'OPEN',
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

  console.log('✅ Enquête "Stationnement et déplacements dans le centre historique" créée (OPEN).');
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
