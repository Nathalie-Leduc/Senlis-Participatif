// ══════════════════════════════════════════════════════════
// Validation — parkings gérés par l'administration (S5R2-05)
// ══════════════════════════════════════════════════════════

import { z } from 'zod';

export const PARKING_REGIMES = ['GRATUIT', 'ZONE_ROUGE', 'ZONE_VERTE', 'GARE', 'DUREE_LIMITEE', 'PARC_PAYANT'];
export const PARKING_CHARGING = ['AUCUNE', 'EXISTANTE', 'EN_PROJET'];

// Un cadre large autour de la commune de Senlis : un point en dehors
// est presque toujours une erreur de saisie — le plus souvent latitude
// et longitude inversées (2,58 / 49,20 au lieu de 49,20 / 2,58).
// Analogie : le code postal d'une adresse — 60300 et pas 75001.
export const SENLIS_BOUNDS = { minLat: 49.15, maxLat: 49.25, minLng: 2.5, maxLng: 2.68 };

// Un nombre entier positif, ou null pour « effacer / inconnu »
const count = (label) => z.union([
  z.null(),
  z.number({ invalid_type_error: `${label} : un nombre est attendu` }).int(`${label} : un nombre entier est attendu`).min(0, `${label} : pas de nombre négatif`).max(5000, `${label} : nombre trop grand`),
]);

// ── Emplacements (recette du 20/10) ──────────────────────────
// GeoJSON standard : une GeometryCollection de points (une aire de
// stationnement) et de traits (des places le long d'une rue). Chaque
// coordonnée est [longitude, latitude] — l'ordre GeoJSON, inverse de
// celui qu'on dit à l'oral.
// Analogie : sur un plan papier, on colle des gommettes (points) et on
// surligne des bouts de rue au feutre (traits).
const OUT_OF_SENLIS = 'Un emplacement est hors de Senlis (latitude et longitude inversées ?)';
const position = z.tuple([
  z.number().min(SENLIS_BOUNDS.minLng, OUT_OF_SENLIS).max(SENLIS_BOUNDS.maxLng, OUT_OF_SENLIS),
  z.number().min(SENLIS_BOUNDS.minLat, OUT_OF_SENLIS).max(SENLIS_BOUNDS.maxLat, OUT_OF_SENLIS),
]);
const pointGeometry = z.object({ type: z.literal('Point'), coordinates: position });
const lineGeometry = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(position).min(2, 'Un trait compte au moins 2 points').max(200, 'Trait trop long (200 points au plus)'),
});
export const MAX_LOCATIONS = 50;
const geometry = z.union([
  z.null(),
  z.object({
    type: z.literal('GeometryCollection'),
    geometries: z.array(z.discriminatedUnion('type', [pointGeometry, lineGeometry]))
      .max(MAX_LOCATIONS, `${MAX_LOCATIONS} emplacements au plus par parking`),
  }),
])
  // Une collection vide = pas placé : on enregistre null
  .transform((g) => (g && g.geometries.length === 0 ? null : g));

const fields = {
  name: z.string({ required_error: 'Le nom est obligatoire' }).trim().min(2, 'Le nom doit contenir au moins 2 caractères').max(120),
  places: count('Nombre de places').optional(),
  regime: z.union([z.null(), z.enum(PARKING_REGIMES)]).optional(),
  charging: z.enum(PARKING_CHARGING).optional(),
  chargingPoints: count('Points de recharge').optional(),
  pmrPlaces: count('Places PMR').optional(),
  // Une remarque vide = pas de remarque
  note: z.union([z.null(), z.string().trim().max(300)]).optional()
    .transform((v) => (v === '' ? null : v)),
  geometry: geometry.optional(),
};

function consistency(data, ctx) {
  // Points de recharge sans recharge : incohérent
  if (data.charging === 'AUCUNE' && data.chargingPoints > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chargingPoints'],
      message: 'Des points de recharge sont indiqués, mais la recharge est « aucune »',
    });
  }
}

export const createParkingSchema = z.object(fields).superRefine(consistency);

// En modification, tout est facultatif (on n'envoie que ce qui change)
export const updateParkingSchema = z.object({ ...fields, name: fields.name.optional() }).superRefine(consistency);
