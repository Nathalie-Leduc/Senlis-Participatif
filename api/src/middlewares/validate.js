// ══════════════════════════════════════════════════════════
// Middleware validate(schema)
//
// Prend un schéma Zod et valide req.body avec. Si c'est bon,
// req.body est remplacé par les données nettoyées (trimées,
// lowercasées). Sinon, on renvoie une 400 avec les détails.
//
// Usage dans une route :
//   router.post('/register', validate(registerSchema), ctrl.register);
// ══════════════════════════════════════════════════════════

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Zod retourne un tableau d'erreurs détaillées.
      // On les reformate en { champ: "message" } pour le front.
      const details = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.');
        details[field] = issue.message;
      }

      const error = new Error('Données invalides');
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = details;
      return next(error);
    }

    // Remplace req.body par les données nettoyées par Zod
    // (email en minuscules, pseudo trimé, etc.)
    req.body = result.data;
    next();
  };
}
