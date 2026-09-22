// ══════════════════════════════════════════════════════════
// Validateurs Zod — Enquêtes (Survey → Question → QuestionOption)
// ══════════════════════════════════════════════════════════

import { z } from 'zod';

const surveyStatus = z.enum(['DRAFT', 'OPEN', 'CLOSED']);
const audience = z.enum(['TOUS', 'RESIDENTS', 'COMMERCANTS']);
const questionType = z.enum([
  'CHOIX_UNIQUE',
  'CHOIX_MULTIPLE',
  'NOMBRE',
  'OUI_NON',
  'TEXTE_LIBRE',
]);

// Seuls ces types affichent une liste d'options (radio / cases à
// cocher) — NOMBRE et TEXTE_LIBRE n'en ont pas besoin.
// OUI_NON est un cas particulier : le schéma (voir Answer dans
// schema.prisma) le représente aussi via optionId, pas un booléen
// direct — donc une question OUI_NON a bien 2 options ("Oui"/"Non"),
// mais l'admin n'est pas obligé de les taper à la main (voir
// toNestedQuestionsCreate dans le contrôleur, qui les génère par
// défaut si absentes).
const OPTIONS_REQUIRED_TYPES = ['CHOIX_UNIQUE', 'CHOIX_MULTIPLE'];
const OPTIONS_OPTIONAL_BINARY_TYPES = ['OUI_NON'];

const questionOptionSchema = z.object({
  label: z.string().trim().min(1, "Le libellé de l'option est requis").max(200),
  // Cohérence avec Question.syncsToProfile vérifiée plus bas
  // (SYNC_VALID_VALUES) — accepté ici comme simple chaîne, la vraie
  // validation dépend de la question PARENTE, impossible à exprimer
  // au niveau d'une option isolée.
  syncValue: z.string().trim().min(1).optional(),
});

// Une seule liste de valeurs valides par champ profil ciblé — la
// même que les enums Prisma correspondants (Situation, Quartier,
// TravailType). Dupliquée ici plutôt qu'importée : les validateurs
// Zod du projet restent volontairement indépendants du client Prisma
// généré (voir les autres enums de ce fichier, ex. questionType).
const SYNC_VALID_VALUES = {
  situation: ['CENTRE_RESIDENT', 'AUTRE_QUARTIER', 'HORS_SENLIS'],
  quartier: ['BRICHEBAY', 'BON_SECOURS', 'VAL_AUNETTE_GATELIERE', 'ZONE_INDUSTRIELLE', 'VILLEVERT', 'JARDINIERS'],
  travailleQuartier: ['CENTRE_HISTORIQUE', 'BRICHEBAY', 'BON_SECOURS', 'VAL_AUNETTE_GATELIERE', 'ZONE_INDUSTRIELLE', 'VILLEVERT', 'JARDINIERS'],
  travailType: ['COMMERCANT', 'SALARIE'],
};

// Référence par POSITION (order), pas par id réel : au moment où
// l'admin construit une nouvelle enquête, les questions/options n'ont
// pas encore d'id en base — elles seront créées dans la même requête.
// Le contrôleur résout ces positions vers les vrais id APRÈS coup,
// dans un second passage (voir resolveBranching).
const showIfSchema = z.object({
  questionOrder: z.number().int().min(0),
  optionOrder: z.number().int().min(0),
});

// superRefine plutôt que deux champs séparés : la règle "options
// obligatoires SI type = CHOIX_*" dépend de DEUX champs à la fois —
// impossible à exprimer avec de simples .min()/.optional() sur un
// champ isolé.
const questionSchema = z.object({
  label: z.string().trim().min(5, 'La question doit contenir au moins 5 caractères').max(300),
  helpText: z.string().trim().max(300).optional(),
  type: questionType,
  required: z.boolean().optional(),
  options: z.array(questionOptionSchema).optional(),
  // Absent = toujours affichée. Présent = affichée seulement si le
  // répondant a choisi CETTE option à une question ANTÉRIEURE (voir
  // EnqueteRepondre.jsx côté client pour la logique d'affichage, et
  // submitResponse côté contrôleur pour ne pas exiger de réponse à
  // une question jamais montrée).
  showIf: showIfSchema.optional(),
  // Une seule valeur reconnue pour l'instant : 'VILLE_FR' (suggestions
  // de commune via l'API officielle geo.api.gouv.fr côté client).
  // z.literal plutôt que z.string() : toute AUTRE valeur est rejetée
  // d'emblée, pas seulement ignorée silencieusement plus tard.
  uiHint: z.literal('VILLE_FR').optional(),
  // Si renseigné, une réponse à cette question met AUSSI à jour ce
  // champ du profil du répondant — voir SYNC_VALID_VALUES plus haut
  // pour les valeurs attendues sur chaque option, et submitResponse
  // côté contrôleur pour l'application réelle.
  syncsToProfile: z.enum(['situation', 'quartier', 'travailleQuartier', 'travailType']).optional(),
}).superRefine((q, ctx) => {
  if (q.uiHint && q.type !== 'TEXTE_LIBRE') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['uiHint'],
      message: 'uiHint "VILLE_FR" n\'a de sens que pour une question TEXTE_LIBRE',
    });
  }

  if (q.syncsToProfile) {
    // CHOIX_UNIQUE seulement : un champ profil ne peut recevoir
    // qu'UNE valeur, une question à choix multiple ou libre n'a pas
    // de réponse unique à y écrire proprement.
    if (q.type !== 'CHOIX_UNIQUE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['syncsToProfile'],
        message: 'syncsToProfile n\'a de sens que pour une question CHOIX_UNIQUE',
      });
    } else {
      const validValues = SYNC_VALID_VALUES[q.syncsToProfile];
      (q.options || []).forEach((opt, index) => {
        if (opt.syncValue && !validValues.includes(opt.syncValue)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options', index, 'syncValue'],
            message: `syncValue doit être l'une de : ${validValues.join(', ')}`,
          });
        }
      });
    }
  }

  if (OPTIONS_REQUIRED_TYPES.includes(q.type)) {
    if (!q.options || q.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: `Une question de type ${q.type} doit proposer au moins 2 options`,
      });
    }
    return;
  }

  if (OPTIONS_OPTIONAL_BINARY_TYPES.includes(q.type)) {
    // Ni interdites (le schéma en a besoin) ni obligatoires à la
    // saisie (des "Oui"/"Non" par défaut suffisent la plupart du
    // temps) — juste : si l'admin en fournit, il en faut EXACTEMENT 2.
    if (q.options && q.options.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Une question OUI_NON doit avoir exactement 2 options si vous les personnalisez (sinon "Oui"/"Non" par défaut)',
      });
    }
    return;
  }

  // NOMBRE, TEXTE_LIBRE : jamais d'options.
  if (q.options && q.options.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: `Une question de type ${q.type} ne doit pas avoir d'options`,
    });
  }
});

export const createSurveySchema = z.object({
  title: z.string().trim().min(5, 'Le titre doit contenir au moins 5 caractères').max(200),
  description: z.string().trim().min(10, 'La description doit contenir au moins 10 caractères'),
  audience: audience.optional(),
  status: surveyStatus.optional(), // défaut DRAFT géré par Prisma si absent
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
  questions: z.array(questionSchema).min(1, 'Une enquête doit contenir au moins une question'),
});

// Édition : tout est optionnel — on ne modifie que les champs envoyés.
// `questions`, si présent, REMPLACE l'intégralité du questionnaire
// existant (voir le contrôleur pour le détail et ses garde-fous).
export const updateSurveySchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).optional(),
  audience: audience.optional(),
  status: surveyStatus.optional(),
  resultsPublished: z.boolean().optional(),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
  questions: z.array(questionSchema).min(1).optional(),
});

// Query params de la liste publique : ?page=2&limit=20&status=OPEN
export const listSurveysQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  // Volontairement restreint à OPEN/CLOSED — jamais DRAFT dans l'URL,
  // même filtré (même logique que listProposalsQuerySchema).
  status: z.enum(['OPEN', 'CLOSED']).optional(),
});

// Liste ADMIN : les 3 statuts, pour retrouver les brouillons.
export const adminListSurveysQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: surveyStatus.optional(),
});

// ── Soumission de réponse (citoyen) ─────────────────────
//
// Ce schéma ne valide QUE la forme du payload (un questionId, et
// EXACTEMENT un champ de valeur parmi les quatre). Il ne peut pas
// valider le FOND (est-ce que ce questionId existe bien dans CETTE
// enquête ? le type de la question correspond-il au champ rempli ?
// l'option choisie appartient-elle à la bonne question ?) — cette
// partie dépend des données de la base, pas juste de la forme du
// JSON, donc elle vit dans le contrôleur (voir buildAnswerRows).
const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid().optional(),           // CHOIX_UNIQUE / OUI_NON
  optionIds: z.array(z.string().uuid()).optional(), // CHOIX_MULTIPLE
  valueNumber: z.number().optional(),               // NOMBRE
  valueText: z.string().trim().optional(),          // TEXTE_LIBRE
}).superRefine((a, ctx) => {
  const filled = ['optionId', 'optionIds', 'valueNumber', 'valueText']
    .filter((key) => a[key] !== undefined);

  if (filled.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Chaque réponse doit remplir exactement un champ parmi optionId, optionIds, valueNumber, valueText',
    });
  }
});

export const submitResponseSchema = z.object({
  answers: z.array(answerSchema).min(1, 'Au moins une réponse est requise'),
});
