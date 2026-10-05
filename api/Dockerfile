# ══════════════════════════════════════════════════════════════
# Image Docker de l'API — Senlis Participatif (S5A-08)
#
# ⚠️ Utilisée pour le DÉVELOPPEMENT (docker compose) et comme preuve
# de portabilité. La production (Clever Cloud) déploie l'API
# directement depuis Git, sans cette image.
#
# Corrigé en S5A-08 — l'ancienne version ne pouvait pas fonctionner :
#  1. elle cherchait package-lock.json dans api/, alors que le projet
#     est un « monorepo npm workspaces » : le SEUL lockfile est à la
#     racine → `npm ci` échouait ;
#  2. `npm ci --omit=dev` déclenchait `postinstall: prisma generate`…
#     alors que prisma était une devDependency, donc absent (prisma et
#     dotenv sont désormais des dépendances de production : ils servent
#     aussi à `prisma migrate deploy` au déploiement) ;
#  3. le conteneur tournait en root (ANSSI : principe du moindre
#     privilège — si l'API était compromise, l'attaquant serait root).
#
# ⚠️ Le contexte de build est la RACINE du dépôt (voir docker-compose.yml) :
#   docker build -f api/Dockerfile .
# ══════════════════════════════════════════════════════════════

FROM node:22-alpine

WORKDIR /app

# 1. D'abord les SEULS fichiers qui décrivent les dépendances.
#    Docker met chaque étape en cache : tant que ces fichiers ne
#    changent pas, la longue installation n'est pas refaite quand on
#    modifie une simple ligne de code dans src/.
COPY package.json package-lock.json ./
COPY api/package.json api/prisma.config.js ./api/
COPY api/prisma ./api/prisma
# Le lockfile mentionne aussi l'espace de travail client : npm veut
# trouver son package.json, même s'il n'installe pas ses dépendances.
COPY client/package.json ./client/

# 2. Dépendances de PRODUCTION de l'API uniquement (-w api --omit=dev :
#    ni React, ni Vitest, ni ESLint dans l'image). Le postinstall génère
#    le client Prisma dans api/src/generated/. DATABASE_URL factice :
#    la génération n'ouvre aucune connexion, mais la config Prisma lit
#    la variable.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    npm ci -w api --omit=dev --no-audit --no-fund

# 3. Le code (fusionné avec le client Prisma généré juste avant)
COPY api/src ./api/src
COPY api/scripts ./api/scripts

# 4. Dossier des images envoyées, appartenant à l'utilisateur non-root
RUN mkdir -p /app/api/uploads && chown -R node:node /app/api/uploads

WORKDIR /app/api
# L'image officielle Node fournit l'utilisateur « node » (sans privilège)
USER node

EXPOSE 3000

# Docker sait dire si l'API répond VRAIMENT (et pas seulement si le
# processus existe) : il interroge la route de santé toutes les 30 s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health > /dev/null || exit 1

CMD ["node", "src/index.js"]
