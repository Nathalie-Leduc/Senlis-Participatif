# API — Senlis Participatif

> Express 5 + Prisma 7 + PostgreSQL. API REST versionnée (`/api/v1`), stateless (JWT), documentée par Swagger sur `/api/v1/docs`.

## Démarrage

```bash
npm install
cp .env.example .env          # puis compléter ↓
npx prisma migrate dev        # crée/synchronise la BDD
npm run seed                  # données de démonstration
npm run dev                   # http://localhost:3000 (rechargement auto)
```

La BDD tourne via le `docker-compose.yml` racine (`docker compose up -d postgres`).

## Variables d'environnement

| Variable | Exemple | Rôle |
|---|---|---|
| `DATABASE_URL` | `postgresql://senlis:secret@localhost:5432/senlis` | Connexion PostgreSQL (Prisma) |
| `PORT` | `3000` | Port de l'API |
| `CLIENT_URL` | `http://localhost:5173` | Origine autorisée (CORS) + base des liens email |
| `JWT_SECRET` | *(64 caractères aléatoires)* | Signature des jetons — **jamais commité** |
| `JWT_EXPIRES_IN` | `7h` | Durée de vie d'une session |
| `SMTP_HOST` | `sandbox.smtp.mailtrap.io` (dev) / `smtp-relay.brevo.com` (prod) | Serveur d'envoi |
| `SMTP_PORT` | `2525` (dev) / `587` (prod) | Port SMTP |
| `SMTP_USER` / `SMTP_PASS` | *(fournis par Mailtrap / Brevo)* | Identifiants SMTP |
| `EMAIL_FROM` | `Senlis Participatif <no-reply@…>` | Expéditeur affiché |
| `TOKEN_TTL_MINUTES` | `60` | Durée de vie des jetons email |

> 📧 **Dev = Mailtrap** (tout email est capturé, rien ne part réellement) · **Prod = Brevo** (SPF/DKIM configurés sur le domaine). Le code ne change pas : seul le `.env` change.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur avec rechargement (`node --watch`) |
| `npm start` | Serveur production |
| `npm run seed` | Injecte les données de démo (`prisma/seed.js`) |
| `npm test` | Tests d'intégration Vitest + Supertest (BDD de test jetable) |
| `npm run lint` | ESLint |
| `npx prisma migrate dev` | Nouvelle migration en dev |
| `npx prisma migrate deploy` | Applique les migrations (prod / CI) |
| `npx prisma studio` | Explorateur visuel de la BDD |

## Architecture

```
src/
├── routes/        Déclaration des endpoints (auth, proposals, surveys, comments)
├── middlewares/   auth (JWT) · isAdmin · validate (Zod) · rateLimiter · errorHandler
├── controllers/   Logique métier — ne voient que des données déjà validées
├── services/      email.js (Nodemailer) · token.js (hash des jetons) · stats.js (agrégats)
├── validators/    Schémas Zod (réutilisés par les tests)
└── prisma/        schema.prisma · migrations/ · seed.js
```

**Chaîne d'une requête** : `Helmet/CORS → rate limit → auth (si protégée) → validate (Zod) → contrôleur → Prisma → PostgreSQL`. Toute règle métier critique est doublée d'une contrainte en base (unicité du vote, unicité de la réponse d'enquête) : le client peut mentir, l'API vérifie, la base garantit.

## Conventions

- Réponses d'erreur normalisées : `{ "error": { "code", "message", "details?" } }`
- Codes utilisés : `400` validation · `401` non authentifié · `403` interdit · `404` introuvable · `409` conflit d'unicité (déjà voté / déjà répondu) · `429` rate limit
- Tout nouvel endpoint = schéma Zod + test d'intégration + bloc Swagger dans la même PR

## RGPD — effacement de compte

`DELETE /api/v1/auth/me` : votes **supprimés** (cascade), propositions/commentaires/réponses d'enquête **anonymisés** (`SetNull`) — les statistiques agrégées survivent au départ d'un compte. Détail : voir le dictionnaire de données dans le dépôt de docs.
