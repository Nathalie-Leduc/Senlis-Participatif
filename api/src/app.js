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
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import proposalsRouter from './routes/proposals.js';
import surveysRouter from './routes/surveys.js';
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

// ── Fichiers statiques (images uploadées) ────────────────────
// Servi hors de /api/v1 : ce n'est pas une "ressource API" au sens
// JSON habituel, mais un fichier brut qu'un <img src="..."> charge
// directement — même logique que n'importe quel asset statique.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting global : 100 requêtes / minute / IP en production.
//
// ⚠️ Même piège que pour authLimiter (voir routes/auth.js) : une
// suite de tests d'intégration fait de VRAIES requêtes HTTP les
// unes après les autres — inscription + vérification + connexion
// pour chaque citoyen simulé, parfois plusieurs par test. Avec
// des dizaines de tests, on dépasse vite 100 requêtes en quelques
// secondes. Sans cet assouplissement, ce videur-ci bloquerait les
// tests aussi silencieusement que l'autre (un 429 que Supertest
// ne fait pas remonter comme une erreur — juste une réponse qu'on
// ne vérifie pas forcément).
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 100,
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
app.use('/api/v1/surveys', surveysRouter);

// Sprint 6 → app.use('/api/v1/comments', commentsRouter);

// ── Gestionnaire d'erreurs ──────────────────────────────────
app.use(errorHandler);

export default app;