// ══════════════════════════════════════════════════════════
// Brouillon du formulaire d'inscription (S5R-01)
//
// Recette : après une erreur (réseau, lien de vérification…), la
// personne revenait sur un formulaire VIDE et devait tout ressaisir.
// On garde donc une copie de sa saisie dans le sessionStorage de
// l'onglet — effacée à la fermeture de l'onglet, et dès que
// l'inscription réussit.
//
// ⚠️ Jamais les mots de passe, ni la case « j'ai pris connaissance » :
// un mot de passe n'a rien à faire en clair dans le stockage du
// navigateur, et la case doit être cochée en connaissance de cause,
// à chaque fois.
//
// Analogie : le brouillon d'un email non envoyé — on le retrouve si
// l'onglet se recharge, mais on ne le garde pas une fois parti.
//
// Déclaré dans la politique de confidentialité (constants/legal.js,
// BROWSER_STORAGE) : le test de concordance le vérifie.
// ══════════════════════════════════════════════════════════

const DRAFT_KEY = 'senlis:registerDraft';

// Seuls ces champs sont conservés (liste BLANCHE : un champ ajouté
// plus tard au formulaire n'est pas enregistré par accident)
const SAFE_FIELDS = ['pseudo', 'email', 'situation', 'quartier', 'travailleASenlis', 'travailleQuartier', 'travailType'];

/** @returns {object} les champs sauvegardés, ou {} */
export function loadRegisterDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {}; // stockage indisponible (navigation privée stricte) ou contenu abîmé
  }
}

/** @param {object} form - l'état complet du formulaire */
export function saveRegisterDraft(form) {
  try {
    const safe = Object.fromEntries(SAFE_FIELDS.map((key) => [key, form[key]]));
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
  } catch {
    // Pas de brouillon possible : le formulaire fonctionne quand même
  }
}

export function clearRegisterDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // rien à faire
  }
}
