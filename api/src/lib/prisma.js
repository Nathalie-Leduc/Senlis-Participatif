// ══════════════════════════════════════════════════════════
// Prisma Client — singleton partagé par toute l'API
//
// Pourquoi un singleton ? En dev, Node --watch relance le
// fichier à chaque modif. Sans singleton, chaque relance
// crée un NOUVEAU PrismaClient → les connexions BDD fuient.
// Le singleton stocke le client dans `globalThis` (un objet
// qui survit aux rechargements) → une seule connexion.
//
// En prod, pas de --watch, donc pas de problème. Mais le
// singleton ne coûte rien et protège dans tous les cas.
// ══════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
