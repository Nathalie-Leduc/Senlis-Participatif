#!/bin/bash -l
# ══════════════════════════════════════════════════════════
# Purge RGPD quotidienne (S5-22) — lancée par clevercloud/cron.json
#
# Chaque nuit à 3 h 17 (heure UTC, donc 4 h 17 l'hiver et 5 h 17 l'été
# à Senlis) : comptes inactifs après les deux avertissements, jetons
# expirés, limites de connexion périmées. Détail : api/scripts/purge.js
# et la section « Durées de conservation » de api/README-api.md.
#
# « bash -l » (première ligne) : Clever Cloud n'ouvre les variables
# d'environnement (DATABASE_URL, SMTP…) qu'aux scripts lancés ainsi.
# Sans cela, la purge ne trouverait pas la base de données.
#
# Le même dépôt sert aussi le site (application « Static ») : ce
# garde-fou ne laisse tourner la purge QUE sur l'application de l'API,
# où SENLIS_PURGE_CRON=true est défini.
# Analogie : le même trousseau pour deux bâtiments, mais seul le
# gardien de l'un d'eux fait la tournée de nuit.
# ══════════════════════════════════════════════════════════

set -euo pipefail

if [ "${SENLIS_PURGE_CRON:-}" != "true" ]; then
  exit 0
fi

cd "$APP_HOME/api"
npm run purge
