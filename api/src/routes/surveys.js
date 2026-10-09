// ══════════════════════════════════════════════════════════
// Routes Enquêtes — /api/v1/surveys/...
//
// 🔓 GET  /surveys          liste publique (paginée) — OPEN/CLOSED
// 🛠️ GET  /surveys/admin    liste d'administration, tous statuts (brouillons inclus)
// 🔓 GET  /surveys/:slug    détail public (questions + options)
//                           (l'équipe peut aussi y voir un brouillon)
// 🔓* GET /surveys/:slug/results  résultats agrégés (*🔓 si publiés, sinon 👑)
// 👑 GET  /surveys/:id/stats      résultats détaillés (jamais soumis au garde-fou de publication)
// 🛠️ POST /surveys          créer (questions/options imbriquées)
// 🛠️ PATCH  /surveys/:id    éditer (questions = remplacement complet si fourni)
// 🛠️ DELETE /surveys/:id    supprimer
// 🛠️ POST /surveys/:id/test mode test : rien n'est enregistré (S5R2-01)
// 🔐 POST /surveys/:id/responses  répondre (citoyen·nes seulement)
//
// 👑 = ADMIN seulement ; 🛠️ = ADMIN ou EDITOR (« Admin-test », S5R2-11),
// l'EDITOR étant limité aux BROUILLONS par canEditDrafts()
// ══════════════════════════════════════════════════════════

import { Router } from 'express';
import { validate, validateQuery } from '../middlewares/validate.js';
import { auth, isAdmin, isStaff, canEditDrafts, optionalAuth, requireVerifiedEmail } from '../middlewares/auth.js';
import * as ctrl from '../controllers/surveysController.js';
import {
  createSurveySchema,
  updateSurveySchema,
  listSurveysQuerySchema,
  adminListSurveysQuerySchema,
  submitResponseSchema,
  statsQuerySchema,
} from '../validators/surveys.js';

const router = Router();

// ── Routes publiques (🔓) ───────────────────────────────
router.get('/', validateQuery(listSurveysQuerySchema), ctrl.list);

// ⚠️ IMPORTANT : déclarée AVANT "/:slug" — sinon Express interpréterait
// "admin" comme une VALEUR de :slug (même piège que sur /proposals).
router.get('/admin', auth, isStaff, validateQuery(adminListSurveysQuerySchema), ctrl.listAdmin);

router.get('/:slug', optionalAuth, ctrl.getBySlug);
router.get('/:slug/results', optionalAuth, ctrl.getResults);

// Vue admin détaillée (résultats complets, jamais soumise au garde-fou
// resultsPublished) — déclarée ici plutôt qu'après les routes 👑
// ci-dessous car elle est en lecture, comme ses voisines /:slug et
// /:slug/results, même si elle exige un rôle admin.
router.get('/:id/stats', auth, isAdmin, validateQuery(statsQuerySchema), ctrl.getDetailedResults);

// ── Routes admin (👑) ───────────────────────────────────
router.post('/', auth, isStaff, validate(createSurveySchema), canEditDrafts('survey'), ctrl.create);
router.patch('/:id', auth, isStaff, validate(updateSurveySchema), canEditDrafts('survey'), ctrl.update);
router.delete('/:id', auth, isStaff, canEditDrafts('survey'), ctrl.remove);

// ── Mode test de l'administration (S5R2-01) ─────────────
// Même validation qu'une vraie réponse, rien n'est enregistré ; tout
// statut (un brouillon se teste aussi), autant de fois que voulu.
router.post('/:id/test', auth, isStaff, validate(submitResponseSchema), canEditDrafts('survey'), ctrl.testResponse);

// ── Réponse (🔐, email vérifié — même exigence que le vote) ──
router.post(
  '/:id/responses',
  auth,
  requireVerifiedEmail,
  validate(submitResponseSchema),
  ctrl.submitResponse,
);

export default router;
