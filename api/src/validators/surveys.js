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
}).superRefine((q, ctx) => {
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
