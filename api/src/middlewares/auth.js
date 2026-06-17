// ══════════════════════════════════════════════════════════
// Middleware auth — le vigile de chaque route protégée
//
// Vérifie le JWT dans l'en-tête Authorization: Bearer <token>
// et injecte req.user = { userId, role }.
//
// Deux variantes exportées :
//   auth     → 401 si pas connecté
//   isAdmin  → 403 si connecté mais pas ADMIN
// ══════════════════════════════════════════════════════════

import { verifyToken } from '../lib/jwt.js';

/**
 * Exige un JWT valide. Injecte req.user.
 */
export function auth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    const error = new Error('Authentification requise');
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    return next(error);
  }

  try {
    const token = header.slice(7); // enlève "Bearer "
    const payload = verifyToken(token);
    // req.user est maintenant disponible dans tous les
    // contrôleurs et middlewares suivants de la chaîne
    req.user = payload;
    next();
  } catch (err) {
    const error = new Error(
      err.name === 'TokenExpiredError'
        ? 'Session expirée — reconnectez-vous'
        : 'Token invalide'
    );
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    next(error);
  }
}

/**
 * Exige le rôle ADMIN (à chaîner APRÈS auth).
 * Usage : router.post('/...', auth, isAdmin, ctrl.create);
 */
export function isAdmin(req, _res, next) {
  if (req.user.role !== 'ADMIN') {
    const error = new Error('Accès réservé aux administrateurs');
    error.status = 403;
    error.code = 'FORBIDDEN';
    return next(error);
  }
  next();
}
