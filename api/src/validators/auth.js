// ══════════════════════════════════════════════════════════
// Validateurs Zod — Auth
//
// Zod valide ET nettoie les données entrantes. Si un champ
// ne passe pas, l'erreur est détaillée et lisible.
//
// Analogie : le vigile à l'entrée du restaurant vérifie
// que tu as une réservation (format email), que tu es
// habillé correctement (longueur du mot de passe), et que
// tu n'essaies pas de rentrer avec un faux nom (trim/lower).
// ══════════════════════════════════════════════════════════

import { z, requiredMessage } from '../lib/zod.js'; // Zod 4 réglé en français (S5R2-08)
import { QUARTIERS, QUARTIERS_RESIDENCE } from '../lib/quartiers.js';
import { normalizePassword, passwordProblem } from '../lib/passwordPolicy.js';

// ── Champs réutilisables ────────────────────────────────

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse email invalide');

// S5R-13b — politique CNIL + NIST combinée (document 21, § 8.5) :
// 15 caractères minimum, AUCUNE règle de composition, refus des mots
// de passe courants ou prévisibles. Toute la règle vit dans
// lib/passwordPolicy.js ; ici, on la branche sur Zod.
//
// Avant (S5A) : 12 caractères et les 4 familles imposées (majuscule,
// minuscule, chiffre, caractère spécial). Les comptes existants ne
// sont pas touchés : la nouvelle règle s'applique au prochain choix.
//
// .transform(normalizePassword) : c'est le texte NORMALISÉ (NFC) qui
// arrive dans le contrôleur, donc qui est haché — voir passwordPolicy.js.
const password = z
  .string({ error: requiredMessage('Le mot de passe est requis') })
  .transform(normalizePassword)
  .superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

const pseudo = z
  .string()
  .trim()
  .min(2, 'Le pseudo doit contenir au moins 2 caractères')
  .max(30, 'Le pseudo ne peut pas dépasser 30 caractères');

// Même 4 valeurs que l'enum Prisma Situation — déclaratif, sans preuve
// demandée (même logique de confiance que le pseudonymat). Sert à
// confronter l'audience ciblée d'une enquête à qui y répond vraiment,
// et au branchement de questions selon la situation déclarée.
const situation = z.enum(
  ['CENTRE_RESIDENT', 'AUTRE_QUARTIER', 'HORS_SENLIS'],
  { error: 'Merci de préciser votre situation' },
);

// Les quartiers de Senlis autres que le centre historique (déjà
// couvert par Situation ; liste commune : lib/quartiers.js) — menu affiché en cascade
// uniquement quand situation = AUTRE_QUARTIER, pour que ces citoyens
// ne se sentent pas réduits à une case fourre-tout, et pour pouvoir
// cibler de futures enquêtes/propositions par quartier précis.
const quartier = z.enum(
  QUARTIERS_RESIDENCE,
  { error: 'Merci de préciser votre quartier' },
);

// Même enum Prisma que quartier ci-dessus, mais CENTRE_HISTORIQUE en
// plus — a du sens comme lieu de TRAVAIL (contrairement à la
// résidence, où Situation.CENTRE_RESIDENT couvre déjà ce cas).
const travailleQuartier = z.enum(
  QUARTIERS,
  { error: 'Merci de préciser le quartier de travail' },
);
const travailType = z.enum(
  ['COMMERCANT', 'SALARIE'],
  { error: 'Merci de préciser si vous dirigez cette activité ou si vous y êtes salarié(e)' },
);

// superRefine plutôt que deux champs indépendants : la règle
// "quartier obligatoire SI situation = AUTRE_QUARTIER" dépend de DEUX
// champs à la fois — impossible à exprimer avec un simple .optional().
function requireQuartierIfAutreQuartier(data, ctx) {
  if (data.situation === 'AUTRE_QUARTIER' && !data.quartier) {
    ctx.addIssue({
      code: 'custom',
      path: ['quartier'],
      message: 'Merci de préciser votre quartier',
    });
  }
  // Même logique, sur l'axe travail : travailType n'a de sens QUE
  // si un quartier de travail a été renseigné (indépendant de
  // situation/quartier ci-dessus — résidence et travail sont deux
  // questions distinctes).
  if (data.travailleQuartier && !data.travailType) {
    ctx.addIssue({
      code: 'custom',
      path: ['travailType'],
      message: 'Merci de préciser si vous dirigez cette activité ou si vous y êtes salarié(e)',
    });
  }
}

// ── Schémas par endpoint ────────────────────────────────

export const registerSchema = z.object({
  email,
  password,
  pseudo,
  situation,
  quartier: quartier.optional(),
  travailleQuartier: travailleQuartier.optional(),
  travailType: travailType.optional(),
  // S5R-05 : la case « Je travaille à Senlis », dite explicitement
  travailleASenlis: z.boolean().optional(),
}).superRefine((data, ctx) => {
  requireQuartierIfAutreQuartier(data, ctx);
  // S5R-13b : à l'inscription, l'adresse et le pseudo sont dans la même
  // requête — on refuse un mot de passe qui les reprend (NIST : « mots
  // propres au contexte »). Seulement si le mot de passe a passé les
  // autres contrôles, pour ne pas afficher deux messages à la fois.
  if (!passwordProblem(data.password)) {
    const problem = passwordProblem(data.password, { email: data.email, pseudo: data.pseudo });
    if (problem) ctx.addIssue({ code: 'custom', path: ['password'], message: problem });
  }
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Le mot de passe est requis'),
  // Optionnel : présent seulement si ce navigateur a déjà passé le
  // 2FA récemment (voir signTrustedDeviceToken) — n'importe quelle
  // chaîne passe la validation ici, la vérification cryptographique
  // réelle a lieu dans login() lui-même, pas ici.
  trustedDeviceToken: z.string().optional(),
});

export const verifyTwoFactorSchema = z.object({
  challengeToken: z.string().min(1, 'Jeton de vérification manquant'),
  code: z.string().regex(/^\d{6}$/, 'Le code doit contenir exactement 6 chiffres'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Jeton manquant'),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Jeton manquant'),
  password,
});

export const updateProfileSchema = z.object({
  pseudo: pseudo.optional(),
  email: email.optional(),
  situation: situation.optional(),
  quartier: quartier.optional(),
  // .nullable() en plus de .optional() : ici, contrairement à
  // l'inscription, il faut pouvoir distinguer "absent du tout" (ne
  // touche pas au champ) de "explicitement null" (efface la valeur —
  // ex. la personne décoche "je travaille à Senlis" après coup).
  travailleQuartier: travailleQuartier.nullable().optional(),
  travailType: travailType.nullable().optional(),
  travailleASenlis: z.boolean().nullable().optional(),
  // Exigé par le contrôleur SEULEMENT si l'email change (S5A-06)
  currentPassword: z.string().optional(),
}).superRefine(requireQuartierIfAutreQuartier);

// DELETE /auth/me — mot de passe exigé (S5A-06)
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Mot de passe requis pour supprimer le compte'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: password,
});

// ── Valeurs possibles du profil, réutilisées ailleurs ──────
// La segmentation des votes (proposalsController.getStats, S5-21)
// a besoin de la liste COMPLÈTE des valeurs de chaque champ du
// profil, pour afficher aussi les groupes vides (« 0 votant ») —
// plutôt que de recopier ces listes une deuxième fois (et risquer
// qu'elles divergent le jour où l'on ajoute un quartier), on expose
// celles des schémas Zod ci-dessus. `.options` est fourni par z.enum.
export const PROFILE_VALUES = {
  situation: situation.options,
  quartier: quartier.options,
  travailleQuartier: travailleQuartier.options,
  travailType: travailType.options,
};
