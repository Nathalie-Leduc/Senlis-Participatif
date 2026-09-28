# API — Senlis Participatif

> Express 5 + Prisma 7 + PostgreSQL. API REST versionnée (`/api/v1`), stateless (JWT). Documentation OpenAPI/Swagger : prévue, pas encore publiée — les routes sont listées dans le cahier des charges (dépôt docs, document 01, §9).

## Démarrage

```bash
npm install
cp .env.example .env          # puis compléter ↓
npx prisma migrate dev        # crée/synchronise la BDD
npm run seed                  # données de démonstration
npm run dev                   # http://localhost:3000 (rechargement auto)
```

La BDD tourne via le `docker-compose.yml` racine (`docker compose up -d postgres`) ou un PostgreSQL installé localement.

## Production (S5A-08)

- `prisma` et `dotenv` sont des dépendances **de production** : `prisma generate` (postinstall) et `prisma migrate deploy` s'exécutent sur l'hébergeur, où les devDependencies ne sont pas installées.
- `TRUST_PROXY` : nombre d'intermédiaires de confiance devant l'API (défaut : `1` en production, `0` sinon) — indispensable pour que le rate limiting voie l'IP réelle des visiteurs.
- Les images (`/uploads/…`) sont servies avec `Cross-Origin-Resource-Policy: same-site`, pour être affichables depuis le domaine du site.
- Image Docker (dev) : `docker build -f api/Dockerfile .` depuis la **racine** (lockfile unique du monorepo), utilisateur non-root.

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
| `npm run seed:prod` | Données réelles de production (admin, proposition, enquête) |
| `npm run purge` | Purge RGPD : comptes inactifs (3 ans, après avertissement) et jetons expirés — `-- --dry-run` pour simuler |
| `npm test` | Tests d'intégration Vitest + Supertest (BDD de test jetable) |
| `npm run lint` | ESLint |
| `npx prisma migrate dev` | Nouvelle migration en dev (base uniquement) |
| `npx prisma generate` | Régénère le client Prisma — **obligatoire après chaque migration** : depuis Prisma 7, `migrate dev` ne le fait plus |
| `npm run migrate:test` | Applique les migrations à la base de test |
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
- Tout nouvel endpoint = schéma Zod + test d'intégration dans la même PR (+ bloc OpenAPI quand la documentation Swagger sera en place)

## RGPD — droits et durées de conservation

**Accès et portabilité** — `GET /api/v1/auth/me/export` : fichier JSON avec le compte, le profil déclaré, les votes et les réponses (libellés lisibles), sans aucun secret (ni empreinte de mot de passe, ni jeton).

**Durées de conservation** — `npm run purge` (une fois par jour en production) :
- jetons email et codes 2FA : effacés 24 h après expiration ou utilisation ;
- comptes citoyens sans connexion depuis 3 ans : email d'avertissement, puis suppression 30 jours plus tard si toujours aucune connexion. Jamais de suppression sans avertissement effectivement envoyé ; jamais de suppression automatique d'un compte admin ;
- journal des actions d'administration (`AdminAuditLog`) : 6 mois.

## Sécurité de l'authentification (S5A-06)

- **Code 2FA** : 5 essais au plus par code, puis il faut se reconnecter.
- **Sessions révocables** : `User.tokenVersion`, recopié dans le JWT (`tv`) ; changer ou réinitialiser son mot de passe l'incrémente → toutes les autres sessions tombent (`401 SESSION_REVOKED`). `PUT /auth/me/password` renvoie un nouveau jeton pour la session courante.
- **Mot de passe exigé** pour changer d'email (`currentPassword`) et pour supprimer son compte (`DELETE /auth/me`, corps `{ password }`).
- **Journal d'administration** : connexions admin, changements de rôle, création/modification/suppression de propositions et d'enquêtes (`src/services/audit.js`), consultable dans Prisma Studio.

Logique : `src/services/retention.js` · tests : `tests/retention.test.js`.

**Effacement à la demande**

`DELETE /api/v1/auth/me` : votes **supprimés** (cascade), propositions/commentaires/réponses d'enquête **anonymisés** (`SetNull`) — les statistiques agrégées survivent au départ d'un compte. Détail : voir le dictionnaire de données dans le dépôt de docs.
