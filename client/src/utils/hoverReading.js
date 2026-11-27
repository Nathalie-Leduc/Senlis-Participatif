// ══════════════════════════════════════════════════════════
// Lecture au survol — QUOI lire (S5R2-07, recette du 08/10)
//
// Fonctions pures (testées sans navigateur réel) :
//  - readableTarget : l'élément survolé porte-t-il du texte à lire ?
//    Lequel, exactement ?
//  - isPrivatePath : pages où l'on ne lit JAMAIS (données personnelles)
//  - fitForSpeech, cleanTextForSpeech : le texte prêt à être dit
//  - frenchBrowserVoices : les voix françaises de l'appareil, les plus
//    naturelles en premier
//
// Constat de recette : « lit même le vide ». La souris passe sans cesse
// sur des conteneurs (une carte, une marge, une grille) : lire tout leur
// contenu, c'est réciter la page au moindre mouvement. Désormais, on ne
// lit que :
//  - une UNITÉ qui a un sens en entier : lien, bouton, titre, cellule,
//    élément de liste, légende, étiquette ;
//  - sinon, un élément qui porte SON PROPRE texte (pas seulement celui
//    de ses enfants) — et s'il est « en ligne » (un <span>, un <strong>),
//    tout le bloc qui le contient, pour lire « 0 participants » et pas
//    seulement « 0 » ;
//  - une image, par son texte alternatif.
// Un conteneur sans texte propre (zone vide, décor) : rien.
//
// Analogie : un guide de musée ne récite pas tout le mur quand on passe
// devant ; il lit le cartel du tableau qu'on regarde.
// ══════════════════════════════════════════════════════════

// Jamais lus : les champs de saisie (ce que la personne tape est à elle),
// ce qui est marqué « ne pas lire » (data-no-read : le pseudo de l'en-tête…)
// et ce qui est caché aux technologies d'assistance (aria-hidden : décor).
const SKIP = 'input, textarea, select, option, [contenteditable=""], [contenteditable="true"], '
  + '[data-no-read], [aria-hidden="true"], [hidden], script, style, noscript';

// Les unités lues en entier, où qu'on les survole
const UNITS = 'a, button, label, summary, legend, caption, figcaption, th, td, li, dt, dd, '
  + 'h1, h2, h3, h4, h5, h6, [role="button"], [role="link"], [role="tab"], [role="menuitem"]';

// Éléments « en ligne » : un morceau de phrase, pas une phrase
const INLINE = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SMALL', 'ABBR', 'TIME', 'CODE',
  'MARK', 'SUB', 'SUP', 'Q', 'CITE', 'BDI', 'DATA', 'KBD', 'VAR']);

// Pages où la lecture au survol ne parle JAMAIS : elles affichent des
// données personnelles (profil, adresse email, comptes des citoyens…),
// qui ne doivent pas partir chez le prestataire de voix (Microsoft).
export const PRIVATE_PATHS = ['/mon-compte', '/admin', '/reset-password', '/verification-email'];

export const isPrivatePath = (pathname) => PRIVATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Retire émojis et pictogrammes : une synthèse vocale qui tombe sur
 * « ♿ » ou « 🦌 » tente de les prononcer (« fauteuil roulant », « cerf »),
 * au milieu d'une phrase. Espaces multiples réduits.
 */
export function cleanTextForSpeech(text) {
  return String(text ?? '')
    // Pictogrammes, drapeaux, et les caractères invisibles qui les
    // assemblent (sélecteur de variante, liaison « ZWJ »)
    .replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|️|‍|⃣/gu, '')
    .replace(/[←-⇿]/gu, '') // flèches → ← ↗
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Coupe un texte trop long (600 caractères, la limite du serveur) à la
 * fin d'une phrase, sinon d'un mot, avec « … ».
 */
export function fitForSpeech(text, max = 600) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (sentenceEnd > max / 2) return slice.slice(0, sentenceEnd + 1);
  const wordEnd = slice.lastIndexOf(' ');
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : slice.length)}…`;
}

/** L'élément a-t-il un morceau de texte à lui (pas seulement dans ses enfants) ? */
const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

/**
 * Le texte d'un élément, comme on le lirait à voix haute : les blocs
 * séparés par un espace (« Titre » + « Description », pas
 * « TitreDescription »), les images remplacées par leur texte
 * alternatif, le contenu exclu (champs, aria-hidden…) ignoré.
 */
export function speakableText(element) {
  const parts = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      parts.push(node.textContent);
      return;
    }
    if (node.nodeType !== 1 || node.matches(SKIP)) return;
    if (node.tagName === 'IMG') {
      parts.push(` ${node.getAttribute('alt') ?? ''} `);
      return;
    }
    const block = !INLINE.has(node.tagName);
    if (block) parts.push(' ');
    node.childNodes.forEach(walk);
    if (block) parts.push(' ');
  };
  element.childNodes.forEach(walk);
  return cleanTextForSpeech(parts.join(''));
}

/**
 * Ce que la lecture au survol doit dire pour l'élément sous la souris.
 *
 * @param {EventTarget} target - e.target d'un « mouseover »
 * @returns {{ element: Element, text: string } | null} null = rien à lire
 */
export function readableTarget(target) {
  if (!target || target.nodeType !== 1 || target.closest(SKIP)) return null;

  if (target.tagName === 'IMG') {
    const alt = cleanTextForSpeech(target.getAttribute('alt'));
    return alt ? { element: target, text: alt } : null;
  }

  let element = target.closest(UNITS);
  if (!element) {
    // Pas d'unité autour : il faut que l'élément porte lui-même du texte
    if (!hasOwnText(target)) return null;
    element = target;
    // Un morceau de phrase → toute la phrase
    while (INLINE.has(element.tagName) && element.parentElement && element.parentElement !== document.body) {
      element = element.parentElement;
    }
  }
  const text = speakableText(element);
  return text ? { element, text } : null;
}

// Les voix « naturelles » des navigateurs : « Microsoft Denise Online
// (Natural) » dans Edge, « Google français » dans Chrome, « Amélie
// (Premium) » sur Mac… — bien moins robotiques que les voix de base.
const NATURAL = /natural|neural|online|google|premium|enhanced|amélioré/i;

/**
 * Les voix françaises de l'appareil, les plus naturelles d'abord.
 * @param {SpeechSynthesisVoice[]} voices
 */
export function frenchBrowserVoices(voices) {
  return (voices ?? [])
    .filter((v) => v.lang?.toLowerCase().startsWith('fr'))
    .sort((a, b) => Number(NATURAL.test(b.name)) - Number(NATURAL.test(a.name))
      || Number(b.lang === 'fr-FR') - Number(a.lang === 'fr-FR'));
}
