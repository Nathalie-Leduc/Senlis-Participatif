// ══════════════════════════════════════════════════════════
// Validateurs Zod — Propositions
// ══════════════════════════════════════════════════════════

import { z } from 'zod';

// Les 6 statuts existent tous côté BDD (schema.prisma), mais un
// admin ne devrait normalement passer que par certaines transitions
// à la main (DRAFT → PUBLISHED → CLOSED). On valide juste que la
// valeur envoyée fait partie de l'enum — la logique de transition
// "légale" reste dans le contrôleur, pas ici.
const proposalStatus = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'CLOSED',
  'ARCHIVED',
]);

// Coordonnées optionnelles (une proposition peut ne pas encore
// avoir de localisation au moment de sa rédaction).
const lat = z.number().min(-90).max(90).optional();
const lng = z.number().min(-180).max(180).optional();

export const createProposalSchema = z.object({
  title: z.string().trim().min(5, 'Le titre doit contenir au moins 5 caractères').max(200),
  summary: z.string().trim().min(10, "L'accroche doit contenir au moins 10 caractères").max(300),
  content: z.string().trim().min(20, "L'argumentaire doit contenir au moins 20 caractères"),
  status: proposalStatus.optional(), // défaut DRAFT géré par Prisma si absent
  lat,
  lng,
  geoJson: z.any().optional(), // le format exact (GeoJSON) est validé côté Leaflet au Sprint 3
  closesAt: z.coerce.date().optional(),
});

// Édition : tout est optionnel — on ne modifie que les champs envoyés.
export const updateProposalSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  summary: z.string().trim().min(10).max(300).optional(),
  content: z.string().trim().min(20).optional(),
  status: proposalStatus.optional(),
  lat,
  lng,
  geoJson: z.any().optional(),
  closesAt: z.coerce.date().optional(),
  moderationNote: z.string().trim().max(500).optional(),
});

// Query params de la liste publique : ?page=2&limit=20
// z.coerce transforme la chaîne de l'URL ("2") en nombre (2) avant validation.
export const listProposalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const voteSchema = z.object({
  value: z.enum(['POUR', 'CONTRE', 'NEUTRE'], {
    errorMap: () => ({ message: 'La valeur doit être POUR, CONTRE ou NEUTRE' }),
  }),
});
