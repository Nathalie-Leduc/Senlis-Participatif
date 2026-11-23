// ══════════════════════════════════════════════════════════
// Routes — lecture par voix naturelle (S5R2-07)
//
// Limite propre à cette route : 40 lectures par minute et par adresse
// IP. Largement assez pour quelqu'un qui lit le site en survolant les
// textes (une lecture toutes les 1,5 s), mais un script qui voudrait
// vider le quota gratuit est freiné tout de suite.
// Analogie : à la médiathèque, on emprunte autant de livres qu'on veut
// lire, pas toute l'étagère d'un coup.
// ══════════════════════════════════════════════════════════

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/ttsController.js';
import { validate } from '../middlewares/validate.js';
import { ttsSchema } from '../validators/tts.js';

export const TTS_PER_MINUTE = 40;

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: TTS_PER_MINUTE, // « max » avant express-rate-limit 8 (même sens)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Trop de lectures en peu de temps — voix de l\'appareil pendant une minute.',
    },
  },
});

const router = Router();

router.get('/', ctrl.status);
router.post('/', ttsLimiter, validate(ttsSchema), ctrl.speak);

export default router;
