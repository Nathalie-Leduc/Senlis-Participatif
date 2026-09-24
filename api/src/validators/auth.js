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

import { z } from 'zod';

// ── Champs réutilisables ────────────────────────────────

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse email invalide');

// Recommandations CNIL (délibération n° 2022-100, référentiel mots
// de passe) : 12 caractères minimum si le mot de passe est la SEULE
// mesure de sécurité (pas de 2FA en complément), avec au moins 3 des
// 4 catégories de caractères — ici on demande les 4, plus strict
// mais plus simple à expliquer côté UI qu'une règle "au moins 3 sur 4".
//
// .regex() plutôt que 4 .refine() séparés : Zod s'arrêterait à la
// première règle échouée avec .refine(), masquant les autres —
// .regex() avec lookaheads (?=...) vérifie les 4 conditions dans la
// MÊME passe, donc le message d'erreur ci-dessous reste correct quel
// que soit ce qui manque exactement.
const password = z
  .string()
  .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
  .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  );

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
  { errorMap: () => ({ message: 'Merci de préciser votre situation' }) },
);

// Les 6 quartiers IRIS (INSEE) de Senlis autres que le centre
// historique (déjà couvert par Situation) — menu affiché en cascade
// uniquement quand situation = AUTRE_QUARTIER, pour que ces citoyens
// ne se sentent pas réduits à une case fourre-tout, et pour pouvoir
// cibler de futures enquêtes/propositions par quartier précis.
const quartier = z.enum(
  ['BRICHEBAY', 'BON_SECOURS', 'VAL_AUNETTE_GATELIERE', 'ZONE_INDUSTRIELLE', 'VILLEVERT', 'JARDINIERS'],
  { errorMap: () => ({ message: 'Merci de préciser votre quartier' }) },
);

// Même enum Prisma que quartier ci-dessus, mais CENTRE_HISTORIQUE en
// plus — a du sens comme lieu de TRAVAIL (contrairement à la
// résidence, où Situation.CENTRE_RESIDENT couvre déjà ce cas).
const travailleQuartier = z.enum(
  ['CENTRE_HISTORIQUE', 'BRICHEBAY', 'BON_SECOURS', 'VAL_AUNETTE_GATELIERE', 'ZONE_INDUSTRIELLE', 'VILLEVERT', 'JARDINIERS'],
  { errorMap: () => ({ message: 'Merci de préciser le quartier de travail' }) },
);
const travailType = z.enum(
  ['COMMERCANT', 'SALARIE'],
  { errorMap: () => ({ message: 'Merci de préciser si vous dirigez cette activité ou si vous y êtes salarié(e)' }) },
);

// superRefine plutôt que deux champs indépendants : la règle
// "quartier obligatoire SI situation = AUTRE_QUARTIER" dépend de DEUX
// champs à la fois — impossible à exprimer avec un simple .optional().
function requireQuartierIfAutreQuartier(data, ctx) {
  if (data.situation === 'AUTRE_QUARTIER' && !data.quartier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
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
      code: z.ZodIssueCode.custom,
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
}).superRefine(requireQuartierIfAutreQuartier);

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
}).superRefine(requireQuartierIfAutreQuartier);

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
