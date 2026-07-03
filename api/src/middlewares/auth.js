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
import prisma from '../lib/prisma.js';

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

/**
 * Exige un email vérifié (à chaîner APRÈS auth).
 *
 * Pourquoi ce n'est pas dans le JWT directement ? Le token est
 * signé à la connexion et reste valide 7h (JWT_EXPIRES_IN) — si
 * on y mettait emailVerified, un citoyen qui vérifie son email
 * APRÈS s'être connecté une première fois devrait se déconnecter/
 * reconnecter pour que ça se voie. En le relisant en BDD à chaque
 * requête sensible, l'information est toujours fraîche.
 *
 * Réutilisé partout où l'intégrité des résultats compte : voter,
 * commenter (Lot 2), répondre à une enquête (Sprint 4) — sans
 * email vérifié, un compte jetable pourrait gonfler les chiffres.
 *
 * Usage : router.put('/:id/vote', auth, requireVerifiedEmail, ctrl.castVote);
 */
export async function requireVerifiedEmail(req, _res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      const error = new Error(
        "Veuillez d'abord vérifier votre email pour participer — un lien vous a été envoyé à l'inscription"
      );
      error.status = 403;
      error.code = 'EMAIL_NOT_VERIFIED';
      return next(error);
    }

    next();
  } catch (err) {
    next(err);
  }
}
