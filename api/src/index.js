// ══════════════════════════════════════════════════════════════
// Senlis Participatif — Point d'entrée de l'API
//
// La "porte d'entrée" du restaurant : on y installe les vigiles
// (Helmet, CORS, rate limit) avant d'orienter vers les cuisines
// (les routes). Toute requête traverse la chaîne de sécurité
// AVANT d'atteindre un contrôleur.
// ══════════════════════════════════════════════════════════════

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Sécurité HTTP ───────────────────────────────────────────
// Helmet durcit les en-têtes (X-Frame-Options, CSP, etc.)
// Analogie : les murs et la serrure du restaurant, avant même
// que le vigile ne regarde les clients.
app.use(helmet());

// CORS : seule l'origine du front est autorisée.
// En production, CLIENT_URL = https://senlis-participatif.fr
// Les clients mobiles natifs (pas de navigateur) ne sont pas
// concernés par CORS : ils n'envoient pas d'en-tête Origin.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // pour les cookies/JWT si besoin
  })
);

// Parse le JSON des requêtes (max 10 Ko pour éviter les abus)
app.use(express.json({ limit: '10kb' }));

// Rate limiting global : 100 requêtes / minute / IP.
// Les routes auth auront leur propre rate limit plus strict
// (voir Sprint 1). Ici on pose le filet de sécurité général.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true, // en-tête RateLimit-* (draft IETF)
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Trop de requêtes — réessayez dans une minute.',
    },
  },
});
app.use(globalLimiter);

// ── Routes ──────────────────────────────────────────────────
// Préfixe /api/v1 dès le Sprint 0 : décision gratuite qui
// permettra à un client mobile ou une mairie (Lot 3) de
// coexister avec une future v2 sans casser l'existant.
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter)

// Sprint 1 → app.use('/api/v1/auth', authRouter);
// Sprint 2 → app.use('/api/v1/proposals', proposalsRouter);
// Sprint 4 → app.use('/api/v1/surveys', surveysRouter);
// Sprint 6 → app.use('/api/v1/comments', commentsRouter);

// ── Gestionnaire d'erreurs ──────────────────────────────────
// Toujours en DERNIER : il attrape ce que les routes n'ont
// pas géré. Le front reçoit un JSON normalisé, jamais une
// stack trace (fuite d'information en prod).
app.use(errorHandler);

// ── Démarrage ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🦌 Senlis Participatif API`);
  console.log(`   → http://localhost:${PORT}/api/v1/health`);
  console.log(`   → Environnement : ${process.env.NODE_ENV || 'development'}\n`);
});

export default app; // exporté pour les tests (Supertest)
