// ══════════════════════════════════════════════════════════
// Routes Auth — /api/v1/auth/...
//
// Chaque route enchaîne : rate limit → validation Zod → contrôleur.
// Les routes sensibles (login, register, forgot) ont un
// rate limit strict pour bloquer le bruteforce.
// ══════════════════════════════════════════════════════════

import { Router } from 'express';
import { createAuthLimiter } from '../middlewares/rateLimiters.js';
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
  verifyTwoFactorSchema,
  deleteAccountSchema,
} from '../validators/auth.js';

const router = Router();

// Rate limit des routes d'authentification : 10 ÉCHECS par fenêtre de
// 15 minutes et par IP en production (les réussites ne comptent pas),
// réponse JSON lisible par le client — voir middlewares/rateLimiters.js.
const authLimiter = createAuthLimiter();

// ── Routes publiques (🔓) ───────────────────────────────

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
// Même limiteur que login : c'est la suite directe de la même
// tentative de connexion, donc exposée au même risque de bruteforce
// (deviner le code à 6 chiffres plutôt que le mot de passe).
router.post('/2fa/verify', authLimiter, validate(verifyTwoFactorSchema), ctrl.verifyTwoFactor);
// authLimiter ajouté en S5A-06 : les jetons (256 bits) sont impossibles
// à deviner, mais aucune route d'authentification ne doit rester sans frein.
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), ctrl.verifyEmail);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), ctrl.resetPassword);
// S5R-01 : même corps que « mot de passe oublié » ({ email }), même
// schéma Zod, même frein anti-abus (chaque appel peut envoyer un email).
router.post('/resend-verification', authLimiter, validate(forgotPasswordSchema), ctrl.resendVerification);

// ── Routes protégées (🔐) ───────────────────────────────

router.get('/me', auth, ctrl.me);
// Droit d'accès et de portabilité (RGPD art. 15 et 20) — S5A-05
router.get('/me/export', auth, ctrl.exportMyData);
router.patch('/me', auth, validate(updateProfileSchema), ctrl.updateProfile);
router.put('/me/password', auth, validate(changePasswordSchema), ctrl.changePassword);
router.delete('/me', auth, validate(deleteAccountSchema), ctrl.deleteAccount);

export default router;
