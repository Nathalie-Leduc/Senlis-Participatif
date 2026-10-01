// ══════════════════════════════════════════════════════════
// Règles de saisie des formulaires d'authentification (S5R-02)
//
// Les MÊMES règles que l'API (api/src/validators/auth.js), vérifiées
// dans le navigateur dès qu'on quitte un champ. Pourquoi les dupliquer ?
// Pour répondre en une fraction de seconde, sans aller-retour réseau.
// L'API reste la vraie gardienne : un navigateur peut être contourné,
// le serveur jamais. Si une règle change d'un côté, la changer aussi
// de l'autre (les messages sont volontairement identiques).
//
// Analogie : le contrôle de la taille d'une valise AVANT d'arriver au
// comptoir d'embarquement. Pratique pour le voyageur — mais c'est
// quand même le comptoir qui a le dernier mot.
//
// Chaque règle reçoit (valeur, toutesLesValeurs) et renvoie un message
// d'erreur, ou null si tout va bien.
// ══════════════════════════════════════════════════════════

// Volontairement simple : quelque chose @ quelque chose . quelque chose,
// sans espace. La VRAIE vérification d'une adresse, c'est l'email de
// confirmation (une adresse qui ne reçoit rien ne sera jamais vérifiée).
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_RULE_MESSAGE =
  'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial';

export function validateEmail(value) {
  const email = (value ?? '').trim();
  if (!email) return 'Saisissez votre adresse email';
  if (!EMAIL_FORMAT.test(email)) return 'Adresse email invalide — elle doit ressembler à prenom@exemple.fr';
  return null;
}

export function validatePseudo(value) {
  const pseudo = (value ?? '').trim();
  if (pseudo.length < 2) return 'Le pseudo doit contenir au moins 2 caractères';
  if (pseudo.length > 30) return 'Le pseudo ne peut pas dépasser 30 caractères';
  return null;
}

export function validateNewPassword(value) {
  const password = value ?? '';
  if (password.length < 12) return 'Le mot de passe doit contenir au moins 12 caractères';
  if (password.length > 128) return 'Le mot de passe ne peut pas dépasser 128 caractères';
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}

export function validatePasswordConfirm(value, password) {
  if (!value) return 'Retapez votre mot de passe pour le confirmer';
  if (value !== password) return 'Les deux mots de passe ne correspondent pas';
  return null;
}

export function required(message) {
  return (value) => (value ? null : message);
}

// ── Suggestion en cas de faute de frappe ──────────────────
//
// On ne REFUSE jamais un domaine inconnu (il en existe des milliers :
// fournisseurs, entreprises, la mairie…). On propose seulement une
// correction quand le domaine saisi ressemble de très près à un
// fournisseur courant : « gmial.com » → « gmail.com ».

const COMMON_DOMAINS = [
  'gmail.com', 'hotmail.fr', 'hotmail.com', 'outlook.fr', 'outlook.com', 'live.fr',
  'yahoo.fr', 'yahoo.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'neuf.fr',
  'laposte.net', 'icloud.com', 'gmx.fr', 'bbox.fr', 'proton.me', 'protonmail.com',
];

/**
 * Distance de Levenshtein : le nombre minimal de lettres à ajouter,
 * supprimer ou remplacer pour passer d'un mot à l'autre.
 * « gmial » → « gmail » : 2 (deux lettres inversées = 2 remplacements).
 */
export function levenshtein(a, b) {
  // Tableau ligne par ligne : seule la ligne précédente est nécessaire
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * @param {string} value - adresse saisie
 * @returns {string|null} l'adresse corrigée proposée, ou null
 *
 * @example
 * suggestEmail('nath@gmial.com')   // 'nath@gmail.com'
 * suggestEmail('nath@gmail.com')   // null (déjà correct)
 * suggestEmail('nath@ville-senlis.fr') // null (domaine inconnu ≠ faute)
 */
export function suggestEmail(value) {
  const email = (value ?? '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;

  let best = null;
  for (const candidate of COMMON_DOMAINS) {
    const distance = levenshtein(domain, candidate);
    // ≤ 2 lettres d'écart : assez pour « gmial », « hotmial », « orang.fr »,
    // trop peu pour confondre deux vrais domaines différents
    if (distance <= 2 && (!best || distance < best.distance)) best = { candidate, distance };
  }
  return best ? `${local}@${best.candidate}` : null;
}
