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

const password = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères');

const pseudo = z
  .string()
  .trim()
  .min(2, 'Le pseudo doit contenir au moins 2 caractères')
  .max(30, 'Le pseudo ne peut pas dépasser 30 caractères');

// ── Schémas par endpoint ────────────────────────────────

export const registerSchema = z.object({
  email,
  password,
  pseudo,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Le mot de passe est requis'),
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
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: password,
});
