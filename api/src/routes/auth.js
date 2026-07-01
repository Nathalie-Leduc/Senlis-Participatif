// ══════════════════════════════════════════════════════════
// Routes Auth — /api/v1/auth/...
//
// Chaque route enchaîne : rate limit → validation Zod → contrôleur.
// Les routes sensibles (login, register, forgot) ont un
// rate limit strict pour bloquer le bruteforce.
// ══════════════════════════════════════════════════════════

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middlewares/validate.js';
import { auth } from '../middlewares/auth.js';
import * as ctrl from '../controllers/authController.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/auth.js';

const router = Router();

// Rate limit strict pour les routes d'authentification :
// 10 tentatives par fenêtre de 15 minutes par IP.
// Analogie : le videur autorise 10 entrées ratées, puis
// te fait attendre 15 min dehors. Ça bloque le bruteforce
// sans gêner un humain normal.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // ⚠️ En test, une suite Vitest enchaîne des dizaines de register/login
  // depuis la même IP en quelques secondes → on desserre la limite.
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
});

// ── Routes publiques (🔓) ───────────────────────────────

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/verify-email', validate(verifyEmailSchema), ctrl.verifyEmail);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), ctrl.resetPassword);

// ── Routes protégées (🔐) ───────────────────────────────

router.get('/me', auth, ctrl.me);
router.patch('/me', auth, validate(updateProfileSchema), ctrl.updateProfile);
router.put('/me/password', auth, validate(changePasswordSchema), ctrl.changePassword);
router.delete('/me', auth, ctrl.deleteAccount);

export default router;
