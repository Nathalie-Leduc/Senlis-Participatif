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
//
// S5A-02 : avant de répondre, on TRADUIT les erreurs « connues »
// venant des bibliothèques (Prisma, Multer, le lecteur JSON
// d'Express). Sans cette traduction, un refus parfaitement normal
// — pseudo déjà pris, image trop lourde — ressortait en 500, comme
// si le serveur avait planté.
//
// Analogie : un interprète au guichet. Prisma dit « P2002 », Multer
// dit « LIMIT_FILE_SIZE » : l'interprète les traduit en « ce pseudo
// est déjà pris » (409) ou « image trop lourde » (413), la langue que
// le client (et l'humain derrière) comprend.
// ══════════════════════════════════════════════════════════════

import multer from 'multer';

// Messages des contraintes d'unicité métier que l'utilisateur peut
// réellement déclencher. Toute autre contrainte (slug…) reste un
// 409 générique : ce sont des collisions internes, rarissimes, dont
// le détail n'apprendrait rien d'utile au client.
const UNIQUE_FIELD_ERRORS = {
  email: { code: 'EMAIL_TAKEN', message: 'Cette adresse email est déjà utilisée' },
  pseudo: { code: 'PSEUDO_TAKEN', message: 'Ce pseudo est déjà pris — choisissez-en un autre' },
};

// Nom d'index unique généré par Prisma : <Modèle>_<champ(s)>_key
// ex. "User_pseudo_key", "Vote_userId_proposalId_key"
const PRISMA_UNIQUE_INDEX = /\b[A-Za-z0-9]+_([A-Za-z0-9_]+)_key\b/;

/**
 * Champs concernés par une violation d'unicité Prisma (P2002).
 *
 * Trois sources possibles, essayées de la plus fiable à la moins
 * fiable :
 *  1. moteur classique : err.meta.target = ['email']
 *  2. « driver adapter » pg (notre cas depuis Prisma 7) :
 *     err.meta.driverAdapterError.cause.constraint.fields = ['email']
 *  3. le NOM de l'index cité dans le message de PostgreSQL.
 *
 * Pourquoi le 3e ? L'adaptateur pg trouve les champs en lisant le
 * texte « Key (pseudo)=(…) already exists »… qui est TRADUIT selon la
 * langue du serveur PostgreSQL. Sur une machine en français, le
 * message devient « La clé « (pseudo)=(…) » existe déjà » : la
 * recherche échoue, et `constraint` arrive vide (bug constaté en
 * S5A-02 : 409 CONFLICT au lieu de PSEUDO_TAKEN). Le nom d'index,
 * lui, ne se traduit jamais : « User_pseudo_key » reste identique
 * dans toutes les langues.
 *
 * Analogie : on ne comprend pas la phrase du guichetier étranger,
 * mais le numéro du formulaire qu'il montre du doigt est le même
 * dans tous les pays.
 *
 * @param {object} err
 * @returns {string[]}
 */
function uniqueFields(err) {
  const target = err.meta?.target;
  if (Array.isArray(target)) return target;
  if (typeof target === 'string') return [target];

  const cause = err.meta?.driverAdapterError?.cause;
  if (cause?.constraint?.fields?.length) return cause.constraint.fields;

  // Fallback indépendant de la langue : "User_pseudo_key" → ['pseudo']
  const indexName = cause?.originalMessage?.match(PRISMA_UNIQUE_INDEX);
  if (indexName) return indexName[1].split('_');

  return [];
}

/**
 * Traduit une erreur de bibliothèque en { status, code, message }.
 * Renvoie null si l'erreur n'est pas d'un type connu (elle est alors
 * traitée telle quelle plus bas).
 *
 * @param {Error & { code?: string, type?: string }} err
 */
function translateKnownError(err) {
  // ── Prisma ────────────────────────────────────────────────
  // P2002 = une contrainte d'unicité a refusé l'écriture. C'est
  // l'« urne scellée » : même si deux requêtes simultanées passent
  // toutes les deux la vérification préalable, la base n'en laisse
  // passer qu'une. On répond alors comme la vérification l'aurait fait.
  if (err.code === 'P2002') {
    const field = uniqueFields(err).find((f) => UNIQUE_FIELD_ERRORS[f]);
    if (field) return { status: 409, ...UNIQUE_FIELD_ERRORS[field] };
    return { status: 409, code: 'CONFLICT', message: 'Cette ressource existe déjà' };
  }
  // P2025 = update/delete sur un enregistrement qui n'existe pas
  if (err.code === 'P2025') {
    return { status: 404, code: 'NOT_FOUND', message: 'Ressource introuvable' };
  }

  // ── Multer (upload de fichiers) ───────────────────────────
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      // 413 « Payload Too Large » : le statut HTTP fait exactement pour ça
      return { status: 413, code: 'FILE_TOO_LARGE', message: 'Image trop lourde (5 Mo maximum)' };
    }
    // LIMIT_UNEXPECTED_FILE (mauvais nom de champ), trop de fichiers…
    return { status: 400, code: 'UPLOAD_ERROR', message: 'Envoi du fichier refusé — un seul fichier, dans le champ « image »' };
  }

  // ── Lecteur JSON d'Express (express.json) ─────────────────
  // Il pose déjà le bon statut (400 / 413) mais pas de code métier.
  if (err.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'Corps de requête JSON mal formé' };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Requête trop volumineuse' };
  }

  return null;
}

export function errorHandler(err, _req, res, _next) {
  const known = translateKnownError(err);

  // Statut HTTP : traduit, sinon porté par l'erreur, sinon 500
  const status = known?.status || err.status || err.statusCode || 500;

  // Log côté serveur (toujours, même en prod — pour le debug). La
  // stack n'a d'intérêt que pour les vraies erreurs inattendues :
  // inutile de noyer la console sous un « pseudo déjà pris ».
  console.error(`[ERROR] ${status} ${err.message}`);
  if (status >= 500 && process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Réponse normalisée — le front peut toujours compter sur
  // cette structure { error: { code, message, details? } }
  res.status(status).json({
    error: {
      // Une erreur 500 ne renvoie jamais le code interne d'une
      // bibliothèque (ex. « P2003 » de Prisma) : il ne sert à rien au
      // client et renseigne un attaquant sur notre pile technique.
      code: known?.code || (status < 500 && err.code) || 'INTERNAL_ERROR',
      message:
        known?.message
        || (status === 500 && process.env.NODE_ENV === 'production'
          ? 'Une erreur inattendue est survenue.'
          : err.message),
      // Détails de validation Zod (champ par champ)
      ...(err.details && { details: err.details }),
    },
  });
}
