// ══════════════════════════════════════════════════════════════
// Senlis Participatif — Configuration de l'application Express
//
// Pourquoi séparer app.js de index.js ?
//
// Avant, index.js faisait DEUX choses en un seul fichier :
// 1. construire l'app Express (middlewares, routes)
// 2. la faire écouter sur un port réseau (app.listen)
//
// Le problème : Supertest n'a PAS besoin qu'un port soit ouvert.
// Il parle directement à l'app Express en mémoire, comme un
// client HTTP fantôme. Si on importe l'ancien index.js dans un
// test, on ouvre quand même un vrai port réseau — inutile, et
// risqué (le port peut déjà être pris par ton `npm run dev`,
// ce qui ferait planter la CI avec "EADDRINUSE").
//
// Analogie : app.js, c'est le restaurant construit et meublé
// (cuisine, salle, vigile à l'entrée). index.js, c'est le
// moment où on ouvre la porte au public. Un inspecteur (un test)
// peut visiter le restaurant construit sans qu'on ouvre au public.
// ══════════════════════════════════════════════════════════════

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import proposalsRouter from './routes/proposals.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// ── Sécurité HTTP ───────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));

// Rate limiting global : 100 requêtes / minute / IP.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
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
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/proposals', proposalsRouter);

// Sprint 4 → app.use('/api/v1/surveys', surveysRouter);
// Sprint 6 → app.use('/api/v1/comments', commentsRouter);

// ── Gestionnaire d'erreurs ──────────────────────────────────
app.use(errorHandler);

export default app;
