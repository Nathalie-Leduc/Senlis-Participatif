// ══════════════════════════════════════════════════════════
// Sauvegarde automatique des saisies en cours (S5R2-13)
//
// Demande du 12/10 : « si l'admin sort de la création d'enquête en
// cours, tout est perdu » — et un citoyen qui a commencé à répondre
// à une enquête perdait lui aussi ses réponses.
//
// Analogie : un marque-page. On ferme le livre, on le rouvre à la bonne
// page ; le marque-page disparaît quand on a fini.
//
// Où ? Dans le localStorage du navigateur (rien n'est envoyé au serveur
// avant l'envoi final). Une clé par compte ET par formulaire :
//   senlis:draft:<id du compte>:<formulaire>
//   ex. senlis:draft:42:survey-form:new
//       senlis:draft:42:survey-answers:<id de l'enquête>
// → un autre compte sur le même ordinateur ne voit jamais le brouillon.
//
// Effacé : après l'envoi réussi, à la déconnexion (clearAllDrafts),
// et au bout de 7 jours (au cas où l'ordinateur serait partagé).
// Déclaré dans la politique de confidentialité (constants/legal.js).
//
// Toutes les fonctions avalent les erreurs du navigateur (navigation
// privée stricte, quota plein…) : une sauvegarde qui échoue ne doit
// JAMAIS empêcher de remplir le formulaire.
// ══════════════════════════════════════════════════════════

const DRAFT_PREFIX = 'senlis:draft:';

/** Durée de vie d'un brouillon : 7 jours */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function keyFor(userId, scope) {
  return `${userId}:${scope}`;
}

/**
 * Enregistre (ou remplace) un brouillon.
 * @param {string} userId - id du compte connecté
 * @param {string} scope - ex. 'survey-form:new'
 * @param {unknown} data - tout ce qui passe en JSON
 */
export function saveDraft(userId, scope, data) {
  if (!userId) return;
  try {
    const entry = JSON.stringify({ savedAt: new Date().toISOString(), data });
    localStorage.setItem(DRAFT_PREFIX + keyFor(userId, scope), entry);
  } catch {
    // Stockage indisponible ou plein : tant pis, on ne bloque rien
  }
}

/**
 * Relit un brouillon, s'il existe et n'a pas plus de 7 jours.
 * Un brouillon périmé ou illisible est effacé au passage.
 * @returns {{ savedAt: string, data: any } | null}
 */
export function loadDraft(userId, scope, now = Date.now()) {
  if (!userId) return null;
  const key = DRAFT_PREFIX + keyFor(userId, scope);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    const age = now - new Date(entry.savedAt).getTime();
    if (!entry.savedAt || Number.isNaN(age) || age > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    try { localStorage.removeItem(key); } catch { /* rien à faire */ }
    return null;
  }
}

/** Efface UN brouillon (après l'envoi réussi, ou « Repartir de zéro ») */
export function clearDraft(userId, scope) {
  if (!userId) return;
  try {
    localStorage.removeItem(DRAFT_PREFIX + keyFor(userId, scope));
  } catch { /* rien à faire */ }
}

/**
 * Efface TOUS les brouillons de ce navigateur, quel que soit le compte
 * — appelé à la déconnexion (ordinateur partagé : on ne laisse rien).
 */
export function clearAllDrafts() {
  try {
    // On collecte d'abord, on supprime ensuite : supprimer pendant le
    // parcours décalerait les index de localStorage.key(i)
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch { /* rien à faire */ }
}

/**
 * Date d'un brouillon, en clair : « 12/10 à 12 h 34 »
 * @param {string} iso
 */
export function formatDraftDate(iso) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} à ${hours} h ${minutes}`;
}
