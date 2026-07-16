// ══════════════════════════════════════════════════════════════
// Route : GET /api/v1/health
//
// Le "pouls" de l'API. Railway (et tout outil de monitoring)
// interroge cette route pour savoir si le serveur est vivant.
// On teste aussi la connexion à PostgreSQL : un serveur debout
// mais déconnecté de sa BDD n'est pas vraiment "en bonne santé".
// ══════════════════════════════════════════════════════════════

import { Router } from 'express';
// On réutilise le MÊME client que le reste de l'API (lib/prisma.js),
// pas une instance séparée : Prisma 7 exige un adapter pour ouvrir
// une connexion, et dupliquer sa création ici aurait ouvert un
// second pool pg pour rien — deux connexions à gérer au lieu d'une.
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    // Un SELECT 1 suffit pour vérifier que PostgreSQL répond.
    // Si la connexion est rompue, Prisma lèvera une exception
    // et on renverra un 503 (Service Unavailable).
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '0.1.0',
    });
  } catch (error) {
    // 503 = le serveur est là mais incapable de traiter les requêtes.
    // Différent de 500 (erreur inattendue) : ici on SAIT que c'est
    // la BDD qui ne répond pas.
    console.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

export default router;
