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
//
// S5R2-03 : remplacer l'enquête stationnement par sa dernière version
// (ex. v3 → v3.1 sur une base de développement qui a des réponses de test) :
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:prod -- --remplacer
// Refusé en PRODUCTION si l'enquête a déjà de vraies réponses : on
// n'efface jamais la parole des habitant·es.
// ══════════════════════════════════════════════════════════

import prisma from '../src/lib/prisma.js';
import { toNestedQuestionsCreate, resolveReferences } from '../src/services/surveyBuilder.js';
import { PARKING_SURVEY } from './surveys/stationnement-v3.js';
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

/**
 * Que faire de l'enquête stationnement ? (S5R2-03) — fonction PURE,
 * testée directement.
 *
 * Analogie : réimprimer un questionnaire. Tant que personne n'y a
 * répondu « pour de vrai », on peut jeter l'ancienne pile ; une fois de
 * vraies réponses reçues, on ne détruit plus rien.
 *
 * @param {{ exists: boolean, responses: number, replace: boolean, production: boolean }} state
 * @returns {'create' | 'skip' | 'replace' | 'refuse'}
 */
export function surveySeedAction({ exists, responses, replace, production }) {
  if (!exists) return 'create';
  if (!replace) return 'skip';
  if (production && responses > 0) return 'refuse';
  return 'replace';
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
        // S5R-10 : la zone concernée, en quartier IRIS
        zoneQuartiers: ['CENTRE_HISTORIQUE'],
        lat: 49.2058,
        lng: 2.5847,
      },
    });

    console.log('✅ Proposition "Piétonnisation du centre historique" créée (PUBLISHED).');
  }

  // ── L'enquête réelle (S5R-06 : version 3 ; S5R2-03 : version 3.1) ──
  // Créée si AUCUNE enquête ne porte déjà son slug — et non plus
  // « si la base est vide » : sur une base de développement qui
  // contient l'ancienne version (v2, avec des réponses de test), la v3
  // peut ainsi être ajoutée à côté, sans rien effacer. En production,
  // la base est vide au lancement : seule la v3 est créée.
  //
  // Le contenu (questions, parcours) vit dans prisma/surveys/
  // stationnement-v3.js ; la création passe par le MÊME service que
  // l'administration (services/surveyBuilder.js, S5R-05).
  const existingSurvey = await prisma.survey.findUnique({ where: { slug: PARKING_SURVEY.slug } });
  const responses = existingSurvey
    ? await prisma.surveyResponse.count({ where: { surveyId: existingSurvey.id } })
    : 0;
  const action = surveySeedAction({
    exists: Boolean(existingSurvey),
    responses,
    replace: process.argv.includes('--remplacer'),
    production: process.env.NODE_ENV === 'production',
  });

  if (action === 'skip') {
    console.log(`ℹ️  Enquête « ${PARKING_SURVEY.title} » déjà en base — aucune créée.`
      + '\n   Pour la remplacer par la dernière version : npm run seed:prod -- --remplacer');
    return;
  }
  if (action === 'refuse') {
    console.error(`❌ L'enquête a déjà ${responses} vraie(s) réponse(s) en production : remplacement refusé.`
      + '\n   Clôturez-la dans l\'administration, puis créez la nouvelle version sous un autre slug.');
    process.exit(1);
  }

  // $transaction : (suppression,) création ET résolution des conditions
  // réussissent ENSEMBLE, ou pas du tout — jamais de base sans enquête
  await prisma.$transaction(async (tx) => {
    if (action === 'replace') {
      // Cascade : questions, options, conditions, bulletins et réponses de test
      await tx.survey.delete({ where: { id: existingSurvey.id } });
      console.log(`♻️  Ancienne version supprimée (${responses} réponse(s) de test).`);
    }
    const survey = await tx.survey.create({
      data: {
        slug: PARKING_SURVEY.slug,
        title: PARKING_SURVEY.title,
        description: PARKING_SURVEY.description,
        status: 'OPEN',
        opensAt: new Date(),
        questions: { create: toNestedQuestionsCreate(PARKING_SURVEY.questions) },
      },
    });
    await resolveReferences(tx, survey.id, PARKING_SURVEY.questions);
  });

  console.log(`✅ Enquête « ${PARKING_SURVEY.title} » (v3.1, ${PARKING_SURVEY.questions.length} questions, parcours par profil) créée (OPEN).`);
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
