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

const lat = z.union([z.null(), z.number().min(SENLIS_BOUNDS.minLat).max(SENLIS_BOUNDS.maxLat)]);
const lng = z.union([z.null(), z.number().min(SENLIS_BOUNDS.minLng).max(SENLIS_BOUNDS.maxLng)]);

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
  lat: lat.optional(),
  lng: lng.optional(),
};

/** Latitude et longitude vont ensemble : les deux, ou aucune */
function samePlacement(data, ctx) {
  const hasLat = data.lat !== undefined && data.lat !== null;
  const hasLng = data.lng !== undefined && data.lng !== null;
  if ('lat' in data !== 'lng' in data || hasLat !== hasLng) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lat'],
      message: 'Latitude et longitude vont ensemble : renseignez les deux, ou aucune',
    });
  }
  // Points de recharge sans recharge : incohérent
  if (data.charging === 'AUCUNE' && data.chargingPoints > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chargingPoints'],
      message: 'Des points de recharge sont indiqués, mais la recharge est « aucune »',
    });
  }
}

export const createParkingSchema = z.object(fields).superRefine(samePlacement);

// En modification, tout est facultatif (on n'envoie que ce qui change)
export const updateParkingSchema = z.object({ ...fields, name: fields.name.optional() }).superRefine(samePlacement);
