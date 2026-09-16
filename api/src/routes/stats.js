import { Router } from 'express';
import * as ctrl from '../controllers/statsController.js';

const router = Router();

// 🔓 GET /stats/participants — total de citoyens ayant déjà voté ou
// répondu à une enquête. Aucune donnée sensible exposée (juste un
// nombre), pas besoin d'authentification.
router.get('/participants', ctrl.getParticipantsCount);

export default router;
