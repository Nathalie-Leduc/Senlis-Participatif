// ══════════════════════════════════════════════════════════
// Prisma Client — singleton partagé par toute l'API
//
// Pourquoi un singleton ? En dev, Node --watch relance le
// fichier à chaque modif. Sans singleton, chaque relance
// crée un NOUVEAU PrismaClient → les connexions BDD fuient.
// Le singleton stocke le client dans `globalThis` (un objet
// qui survit aux rechargements) → une seule connexion.
//
// ── Spécificité Prisma 7 — import + adaptateur ──────────────
// Prisma 7 a changé son système d'export : l'import nommé
// { PrismaClient } ne fonctionne plus directement en ESM.
// Il faut aussi lui fournir un "adapter" (ici @prisma/adapter-pg,
// qui pilote une connexion pg classique) plutôt que de laisser
// Prisma gérer seul sa propre connexion — c'est le nouveau moteur
// "client" de Prisma 7, qui remplace l'ancien moteur "classic".
// ══════════════════════════════════════════════════════════

// ── Spécificité Prisma 7 — emplacement du client généré ──────
// Le client généré (par prisma-client-js) vit dans src/generated/prisma
// plutôt que dans node_modules/@prisma/client (voir schema.prisma).
// C'est un module CommonJS classique — l'import nommé direct peut être
// mal détecté selon la forme exacte de son `module.exports`, donc on
// garde le contournement `import pkg from ...` par sécurité (même
// principe qu'avant, juste un chemin différent).
import pkg from '../generated/prisma/index.js';
const { PrismaClient } = pkg;
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis;

// La création du pool ET du client sont regroupées dans cette
// fonction, appelée UNIQUEMENT si aucun client n'existe déjà en
// mémoire (via le `??` juste en dessous). Sans ça, un pg.Pool serait
// recréé à CHAQUE rechargement --watch même quand le client, lui,
// était déjà mis en cache — un pool orphelin par rechargement, qui
// fuit des connexions exactement comme le problème que le singleton
// est censé éviter.
function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // S5R2-08 partie 3 (OWASP A09/A10) : une connexion inactive qui casse
  // (redémarrage de PostgreSQL, coupure réseau chez l'hébergeur) est
  // rattrapée par l'adaptateur — l'API ne plante pas —, mais en SILENCE.
  // onPoolError l'écrit dans les journaux : sans trace, impossible de
  // comprendre après coup pourquoi des requêtes ont échoué.
  const adapter = new PrismaPg(pool, {
    onPoolError: (err) => console.error('[BDD] Connexion PostgreSQL perdue :', err.message),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
