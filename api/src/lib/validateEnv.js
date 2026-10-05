// ══════════════════════════════════════════════════════════
// Validation de la configuration — S5-10
//
// email.js ne connaît ni Mailtrap ni Brevo (c'est le but depuis
// le début : la bascule dev → prod = changer le .env, zéro ligne
// de code) — mais ça veut aussi dire que RIEN n'empêchait de
// déployer en production tout en pointant encore vers Mailtrap
// par erreur, ou avec un SMTP_PASS resté vide : l'app démarrerait
// quand même, et les emails échoueraient silencieusement (voir
// le try/catch de sendEmail(), qui logue sans jamais bloquer).
//
// validateEnv() est une fonction PURE (elle reçoit l'environnement
// en paramètre plutôt que de lire process.env directement) —
// justement pour être facile à tester avec de faux environnements,
// sans avoir à manipuler de vraies variables globales dans les tests.
// ══════════════════════════════════════════════════════════

export function validateEnv(env = process.env) {
  const errors = [];
  const isProd = env.NODE_ENV === 'production';

  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL manquant');
  }

  if (!env.JWT_SECRET || env.JWT_SECRET === 'REMPLACER_PAR_64_CARACTERES_ALEATOIRES') {
    errors.push('JWT_SECRET manquant ou toujours à sa valeur d\'exemple (.env.example)');
  }

  // Les vérifications suivantes ne bloquent qu'en PRODUCTION : en
  // dev, Mailtrap/localhost sont des choix normaux, pas des erreurs.
  if (isProd) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      errors.push('SMTP_HOST/SMTP_USER/SMTP_PASS doivent être renseignés en production (bascule Brevo)');
    } else if (env.SMTP_HOST.includes('mailtrap')) {
      errors.push('SMTP_HOST pointe encore vers Mailtrap — remplacer par Brevo (smtp-relay.brevo.com) avant la mise en production');
    }

    if (!env.CLIENT_URL || env.CLIENT_URL.includes('localhost')) {
      errors.push('CLIENT_URL pointe encore vers localhost en production — les liens dans les emails seraient inutilisables');
    }
  }

  return errors;
}

/**
 * @throws {Error} Si la configuration est invalide — message listant
 * TOUS les problèmes trouvés d'un coup, pas juste le premier, pour
 * éviter à qui déploie de corriger un problème à la fois en relançant
 * dix fois de suite.
 */
export function assertValidEnv(env = process.env) {
  const errors = validateEnv(env);
  if (errors.length > 0) {
    throw new Error(`Configuration invalide :\n- ${errors.join('\n- ')}`);
  }
}
