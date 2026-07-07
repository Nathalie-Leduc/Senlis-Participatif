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

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

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

  // ── Quelques propositions, SEULEMENT si la base est vide ──
  // On évite d'empiler des doublons à chaque "npm run seed".
  const existingCount = await prisma.proposal.count();
  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} proposition(s) déjà en base — aucune créée.`);
    return;
  }

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

main()
  .catch((err) => {
    console.error('❌ Erreur pendant le seed :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());