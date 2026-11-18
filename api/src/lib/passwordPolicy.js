// ══════════════════════════════════════════════════════════
// Politique des mots de passe — CNIL + NIST combinés (S5R-13b)
//
// Document 21, § 8.5. En résumé :
//  - 15 caractères minimum, 128 maximum, AUCUNE règle de composition
//    (plus de « majuscule, chiffre, caractère spécial » imposés) :
//    la longueur fait la solidité (CNIL § 21, NIST SP 800-63B-4) ;
//  - refus des mots de passe COURANTS (liste locale, CNIL § 37) et
//    PRÉVISIBLES (suites de touches, répétitions, nom du site, adresse
//    email ou pseudo de la personne), avec un message qui dit pourquoi ;
//  - longueur comptée en caractères « réels » (un « é » = 1, un emoji
//    = 1) après normalisation Unicode NFC.
//
// La limite de 10 essais par heure et par compte, qui complète cette
// règle (CNIL § 43, cas n° 2), est dans services/loginThrottle.js.
//
// Analogie : avant, on exigeait une clé « avec des dents de quatre
// formes différentes » — courte, compliquée, vite oubliée ou notée
// sur un post-it. Désormais, on exige une clé LONGUE, et on refuse
// seulement les modèles vendus à des millions d'exemplaires.
// ══════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

export const MIN_LENGTH = 15;
export const MAX_LENGTH = 128;

// Les messages sont les MÊMES dans le client (utils/formValidation.js)
export const MESSAGES = {
  tooShort: `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères — une phrase de passe de 4 ou 5 mots est idéale`,
  tooLong: `Le mot de passe ne peut pas dépasser ${MAX_LENGTH} caractères`,
  common: 'Ce mot de passe fait partie des plus utilisés : choisissez-en un autre, par exemple quelques mots pris au hasard',
  predictable: 'Ce mot de passe est trop prévisible (suite de touches ou répétition) : choisissez-en un autre',
  personal: 'Ce mot de passe reprend votre adresse email, votre pseudo ou le nom du site : choisissez-en un autre',
};

/**
 * Nombre de caractères tels qu'on les voit : [...texte] découpe par
 * « point de code » Unicode. `texte.length`, lui, compte les unités
 * UTF-16 — un emoji y vaut 2, ce qui fausserait le minimum.
 */
export const codePointLength = (text) => [...text].length;

/**
 * Normalisation NFC : « é » peut s'écrire avec 1 caractère (é) ou 2
 * (e + accent). Selon le clavier ou l'appareil, la même saisie arrive
 * sous l'une ou l'autre forme ; NFC les ramène à la même — sinon, un
 * mot de passe créé sur un téléphone pourrait être refusé sur un
 * ordinateur. C'est ce texte normalisé qui est haché.
 */
export const normalizePassword = (password) => String(password).normalize('NFC');

/** Forme de comparaison : minuscules, sans accents ni séparateurs */
function compact(text) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // les accents, détachés par NFD
    .toLowerCase()
    .replace(/[\s\-_.'’,;:]/g, '');
}

// ── Liste locale des mots de passe courants ───────────────
// Chargée une seule fois, au premier besoin : environ 5 600 lignes,
// soit quelques centaines de Ko en mémoire. Les lignes « # » sont
// l'en-tête (source et licence). Voir scripts/build-password-blocklist.mjs.
const BLOCKLIST_FILE = fileURLToPath(new URL('./data/mots-de-passe-courants.txt', import.meta.url));
let blocklist;
function commonPasswords() {
  blocklist ??= new Set(
    readFileSync(BLOCKLIST_FILE, 'utf8')
      .split('\n')
      .filter((line) => line && !line.startsWith('#')),
  );
  return blocklist;
}

// Les mots « attendus ici », absents des listes internationales
const CONTEXT_WORDS = [
  'senlis', 'senlisparticipatif', 'participatif', 'participation', 'participationcitoyenne',
  'mairie', 'mairiedesenlis', 'villedesenlis', 'cathedrale', 'cathedraledesenlis',
  'motdepasse', 'monmotdepasse', 'password', 'azerty', 'qwerty', 'bonjour', 'soleil',
];

// Rangées de clavier et suites, doublées pour accepter un « tour »
// (« uiopazerty… »). Une saisie qui y figure en entier est une suite.
const RUNS = [
  'azertyuiopqsdfghjklmwxcvbn', 'qwertyuiopasdfghjklzxcvbnm', 'qwertzuiopasdfghjklyxcvbnm',
  'abcdefghijklmnopqrstuvwxyz', '01234567890123456789',
].flatMap((run) => {
  const twice = run + run;
  return [twice, [...twice].reverse().join('')];
});

// La phrase d'exemple affichée sous le champ (client, jauge du mot de
// passe) : vue par tous les visiteurs, donc la première qu'un attaquant
// essaiera. Refusée en entier ou en partie (au moins 12 lettres).
export const EXAMPLE_PASSPHRASE = 'pivoine lanterne orage remparts';
const EXAMPLE_LETTERS = compact(EXAMPLE_PASSPHRASE);

/** « abcabcabc » → « abc » ; « senlissenlis » → « senlis » ; sinon inchangé */
const unrepeat = (text) => text.replace(/^(.+?)\1+$/, '$1');

/** Ce qui identifie la personne : adresse, début de l'adresse, pseudo */
function personalWords({ email, pseudo } = {}) {
  const words = [];
  if (email) {
    words.push(compact(email));
    words.push(compact(String(email).split('@')[0]));
  }
  if (pseudo) words.push(compact(pseudo));
  // Trop court pour être significatif (« ab ») : ignoré
  return words.filter((w) => w.length >= 3);
}

/**
 * Le problème d'un NOUVEAU mot de passe, ou null s'il est accepté.
 *
 * @param {string} password - déjà normalisé (normalizePassword) ou non
 * @param {{ email?: string, pseudo?: string }} [person] - pour refuser
 *   un mot de passe qui reprend l'adresse ou le pseudo (NIST : « mots
 *   propres au contexte »). Facultatif : sans lui, ce contrôle est sauté.
 * @returns {string|null} un message de MESSAGES
 */
export function passwordProblem(password, person) {
  const text = normalizePassword(password ?? '');
  const length = codePointLength(text);
  if (length < MIN_LENGTH) return MESSAGES.tooShort;
  if (length > MAX_LENGTH) return MESSAGES.tooLong;

  const squeezed = compact(text);
  const list = commonPasswords();
  if (list.has(text.toLowerCase()) || list.has(squeezed)) return MESSAGES.common;

  // Une seule touche ou un petit motif répété, ou une suite de touches
  if (squeezed.length > 0 && (unrepeat(squeezed).length <= 4 || RUNS.some((run) => run.includes(squeezed)))) {
    return MESSAGES.predictable;
  }

  // Le cœur en lettres (« Senlis2026!!!!!! » → « senlis ») est-il un mot
  // du site, ou l'adresse / le pseudo de la personne ?
  const letters = unrepeat(squeezed.replace(/[^a-z]/g, ''));
  if (CONTEXT_WORDS.includes(letters)) return MESSAGES.common;
  if (letters.length >= 12 && (EXAMPLE_LETTERS.includes(letters) || letters.includes(EXAMPLE_LETTERS))) {
    return MESSAGES.common;
  }

  // Mêmes « habillages » du côté de la personne : son adresse ou son
  // pseudo tels quels, ou réduits à leurs lettres (« Remparts60 » →
  // « remparts ») — pour attraper « remparts60remparts60 » comme
  // « Remparts-2026 ».
  const personal = new Set(personalWords(person).flatMap((w) => [w, w.replace(/[^a-z]/g, '')]));
  personal.delete('');
  const shapes = [squeezed, unrepeat(squeezed), unrepeat(squeezed.replace(/\d+$/, '')), letters];
  if (shapes.some((shape) => shape.length >= 3 && personal.has(shape))) return MESSAGES.personal;
  return null;
}
