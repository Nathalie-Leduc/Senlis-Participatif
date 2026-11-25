// ══════════════════════════════════════════════════════════
// Adresse de la base de données (S5-22)
//
// En local : DATABASE_URL, dans .env. Chez Clever Cloud, la base
// PostgreSQL reliée à l'application fournit ses propres variables,
// dont POSTGRESQL_ADDON_URI ; selon les pages de leur documentation,
// DATABASE_URL est aussi injectée… ou pas. Plutôt que de parier, on
// accepte les deux, DATABASE_URL en priorité (on peut toujours la
// forcer à la main dans la console).
//
// Analogie : le courrier arrive au nom de la mairie OU du service
// urbanisme ; dans les deux cas, il atterrit sur le même bureau.
// ══════════════════════════════════════════════════════════

export function databaseUrl(env = process.env) {
  return env.DATABASE_URL || env.POSTGRESQL_ADDON_URI || undefined;
}
