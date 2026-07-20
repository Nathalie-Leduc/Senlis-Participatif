// ══════════════════════════════════════════════════════════
// Routes Enquêtes — /api/v1/surveys/...
//
// 🔓 GET  /surveys          liste publique (paginée) — OPEN/CLOSED
// 👑 GET  /surveys/admin    liste ADMIN, tous statuts (brouillons inclus)
// 🔓 GET  /surveys/:slug    détail public (questions + options)
//                           (un admin peut aussi y voir un brouillon)
// 👑 POST /surveys          créer (questions/options imbriquées)
// 👑 PATCH  /surveys/:id    éditer (questions = remplacement complet si fourni)
// 👑 DELETE /surveys/:id    supprimer
// ══════════════════════════════════════════════════════════

import { Router } from 'express';
import { validate, validateQuery } from '../middlewares/validate.js';
import { auth, isAdmin, optionalAuth, requireVerifiedEmail } from '../middlewares/auth.js';
import * as ctrl from '../controllers/surveysController.js';
import {
  createSurveySchema,
  updateSurveySchema,
  listSurveysQuerySchema,
  adminListSurveysQuerySchema,
  submitResponseSchema,
} from '../validators/surveys.js';

const router = Router();

// ── Routes publiques (🔓) ───────────────────────────────
router.get('/', validateQuery(listSurveysQuerySchema), ctrl.list);

// ⚠️ IMPORTANT : déclarée AVANT "/:slug" — sinon Express interpréterait
// "admin" comme une VALEUR de :slug (même piège que sur /proposals).
router.get('/admin', auth, isAdmin, validateQuery(adminListSurveysQuerySchema), ctrl.listAdmin);

router.get('/:slug', optionalAuth, ctrl.getBySlug);
router.get('/:slug/results', optionalAuth, ctrl.getResults);

// ── Routes admin (👑) ───────────────────────────────────
router.post('/', auth, isAdmin, validate(createSurveySchema), ctrl.create);
router.patch('/:id', auth, isAdmin, validate(updateSurveySchema), ctrl.update);
router.delete('/:id', auth, isAdmin, ctrl.remove);

// ── Réponse (🔐, email vérifié — même exigence que le vote) ──
router.post(
  '/:id/responses',
  auth,
  requireVerifiedEmail,
  validate(submitResponseSchema),
  ctrl.submitResponse,
);

export default router;
