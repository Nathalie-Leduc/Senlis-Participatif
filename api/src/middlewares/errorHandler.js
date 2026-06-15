// ══════════════════════════════════════════════════════════════
// Middleware : gestionnaire d'erreurs global
//
// Express reconnaît un middleware d'erreur à ses 4 paramètres
// (err, req, res, next). Il attrape tout ce qui n'a pas été
// géré par les routes — le filet de sécurité.
//
// Règle d'or : en production, le client ne voit JAMAIS la
// stack trace (fuite d'information). Il reçoit un JSON normalisé
// avec un code machine et un message humain.
// ══════════════════════════════════════════════════════════════

export function errorHandler(err, _req, res, _next) {
  // Log côté serveur (toujours, même en prod — pour le debug)
  console.error(`[ERROR] ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Statut HTTP : l'erreur peut porter le sien, sinon 500
  const status = err.status || err.statusCode || 500;

  // Réponse normalisée — le front peut toujours compter sur
  // cette structure { error: { code, message, details? } }
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message:
        status === 500 && process.env.NODE_ENV === 'production'
          ? 'Une erreur inattendue est survenue.'
          : err.message,
      // Les détails de validation Zod arriveront ici (Sprint 1)
      ...(err.details && { details: err.details }),
    },
  });
}
