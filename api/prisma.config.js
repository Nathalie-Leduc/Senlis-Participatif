// ══════════════════════════════════════════════════════════
// Configuration Prisma CLI — Prisma 7
//
// Depuis Prisma 7, schema.prisma ne connaît plus l'URL de connexion
// (voir le bloc datasource, réduit au provider). Ce fichier prend le
// relais pour tout ce dont la CLI (migrate, studio…) a besoin — même
// schéma que sur Cinés Délices, déjà éprouvé en conditions réelles.
//
// Analogie : schema.prisma décrit le plan de la maison (les pièces =
// les modèles) ; ce fichier-ci, c'est l'adresse postale — deux
// informations différentes qui n'ont pas à vivre au même endroit.
// ══════════════════════════════════════════════════════════

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
    // SSL requis par la plupart des hébergeurs Postgres en prod
    // (Railway, Render, Supabase…) mais absent/inutile en local.
    ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {}),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
});
