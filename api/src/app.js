// Toute la config Express, SANS app.listen()
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10kb' }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes — réessayez dans une minute.' } },
});
app.use(globalLimiter);

app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);

app.use(errorHandler);

export default app;