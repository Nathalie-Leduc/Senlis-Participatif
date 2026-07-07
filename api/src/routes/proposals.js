// ══════════════════════════════════════════════════════════
// Routes Propositions — /api/v1/proposals/...
//
// 🔓 GET  /proposals          liste publique (paginée)
// 🔓 GET  /proposals/:slug    détail public + agrégat des votes
// 👑 POST /proposals          créer
// 👑 PATCH  /proposals/:id    éditer / changer de statut
// 👑 DELETE /proposals/:id    supprimer
//
// Le vote (PUT /proposals/:id/vote) arrive dans un prochain
// morceau du Sprint 2 — pas encore dans ce fichier.
// ══════════════════════════════════════════════════════════

import { Router } from 'express';
import { validate, validateQuery } from '../middlewares/validate.js';
import { auth, isAdmin, requireVerifiedEmail, optionalAuth } from '../middlewares/auth.js';
import * as ctrl from '../controllers/proposalsController.js';
import {
  createProposalSchema,
  updateProposalSchema,
  listProposalsQuerySchema,
  voteSchema,
} from '../validators/proposals.js';

const router = Router();

// ── Routes publiques (🔓) ───────────────────────────────
router.get('/', validateQuery(listProposalsQuerySchema), ctrl.list);
router.get('/:slug', optionalAuth, ctrl.getBySlug);

// ── Routes admin (👑) ───────────────────────────────────
// auth vérifie le JWT ; isAdmin vérifie ENSUITE le rôle — l'ordre
// compte, on ne peut pas savoir si quelqu'un est admin avant de
// savoir qui il est.
router.post('/', auth, isAdmin, validate(createProposalSchema), ctrl.create);
router.patch('/:id', auth, isAdmin, validate(updateProposalSchema), ctrl.update);
router.delete('/:id', auth, isAdmin, ctrl.remove);

// ── Vote (🔐, email vérifié) ─────────────────────────────
// Même logique d'ordre : auth (qui es-tu) → requireVerifiedEmail
// (peux-tu participer) → validate (le payload est-il correct).
router.put('/:id/vote', auth, requireVerifiedEmail, validate(voteSchema), ctrl.castVote);
router.delete('/:id/vote', auth, requireVerifiedEmail, ctrl.removeVote);

export default router;
