import app from './app.js';
import { assertValidEnv } from './lib/validateEnv.js';
import prisma from './lib/prisma.js';

// Échoue vite et fort si la config est incomplète/incohérente —
// plutôt qu'un serveur qui démarre "normalement" mais dont les
// emails échouent silencieusement en coulisses (voir validateEnv.js).
assertValidEnv();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n🦌 Senlis Participatif API`);
  console.log(`   → http://localhost:${PORT}/api/v1/health`);
  console.log(`   → Environnement : ${process.env.NODE_ENV || 'development'}\n`);
});

// ── Arrêt propre (S5R2-08 partie 3, OWASP A10) ───────────────────────
// À chaque déploiement, l'hébergeur envoie SIGTERM avant d'arrêter le
// serveur. Sans réaction, les requêtes en cours (un vote, l'envoi d'un
// questionnaire) seraient coupées net. Ici : on n'accepte plus de
// nouvelle connexion, on laisse finir celles en cours, puis on ferme
// la base. Garde-fou : au bout de 10 s, on s'arrête quoi qu'il arrive.
// Analogie : la mairie ferme ses portes à 17 h, mais sert les personnes
// déjà dans la file avant d'éteindre la lumière.
function shutdown(signal) {
  console.log(`${signal} reçu : arrêt propre du serveur…`);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
