# 🏛️ Senlis Participatif

> Plateforme citoyenne indépendante pour Senlis (Oise) : découvrir des propositions d'aménagement de la ville, voter, et répondre à des enquêtes qui objectivent le débat par des données de terrain. 🦌 Guidé par un cerf mascotte joyeux, parce que la démocratie locale mérite mieux qu'un formulaire gris.
>
> Premier cas d'usage : la **piétonnisation du centre historique le samedi**, argumentée par les données INSEE et une enquête stationnement auprès des résidents et commerçants.

![CI](https://github.com/Nathalie-Leduc/senlis-participatif/actions/workflows/ci.yml/badge.svg)
![Lot](https://img.shields.io/badge/MVP-Lot%201%20en%20cours-1E5F7C)
![Licence](https://img.shields.io/badge/licence-MIT-26333A)

## ✨ Fonctionnalités

| Lot 1 — Socle | Lot 2 — Participation |
|---|---|
| Propositions argumentées et géolocalisées | Arguments citoyens pour / contre / neutre |
| Vote POUR / CONTRE / NEUTRE (un par personne) | Propositions soumises par les citoyens |
| Enquêtes à questions typées, audiences ciblées | Modération a priori avec motif |
| Carte interactive (Leaflet + OSM + couche IRIS) | Notifications email + désinscription 1 clic |
| Comptes vérifiés par email, RGPD by design | |
| 🦌 Mascotte guide-citoyen, micro-interactions, design joyeux | |

## 🧱 Stack

**Front** React 19 · Vite 8 · React Router 7 · Sass · react-leaflet · mascotte SVG inline — **API** Node 22 · Express 5 · Prisma 7 · PostgreSQL · Zod · JWT + Argon2 — **Qualité** Vitest · Testing Library · Supertest · ESLint — **Infra** Docker (dev) · GitHub Actions · Dependabot · Clever Cloud (hébergement souverain, France)

Architecture découplée : le front affiche, l'API décide, la base garantit. L'API (`/api/v1`, JSON) est consommable telle quelle par une future application mobile — documentation OpenAPI/Swagger prévue, pas encore publiée.

## 🚀 Démarrage rapide

**Prérequis** : Node ≥ 22, Git, et PostgreSQL 16 — installé sur la machine **ou** via Docker.

```bash
git clone https://github.com/Nathalie-Leduc/senlis-participatif.git
cd senlis-participatif

# 1. Dépendances — UNE seule installation, à la racine (npm workspaces :
#    un seul package-lock.json pour api/ et client/)
npm install

# 2. Variables d'environnement
cp api/.env.example api/.env        # compléter (voir api/README-api.md)
cp client/.env.example client/.env

# 3. Base de données (si PostgreSQL n'est pas installé sur la machine)
docker compose up -d postgres        # n'écoute que sur 127.0.0.1:5432

# 4. Migrations + client Prisma + données de démo
cd api
npx prisma migrate dev
npx prisma generate                  # obligatoire depuis Prisma 7
npm run seed                         # admin + proposition + enquête de démo
npm run dev                          # API sur http://localhost:3000

# 5. Front (autre terminal, depuis la racine)
npm run dev -w client                # http://localhost:5173
```

Variante tout-Docker : `docker compose up -d` lance la base **et** l'API (image `api/Dockerfile`, utilisateur non-root, lit `api/.env`).

Comptes de démo (seed) : `admin@demo.local` / `citoyen1@demo.local` — mots de passe dans `api/prisma/seed.js` (dev uniquement).

## 📁 Structure

```
senlis-participatif/
├── api/        Express 5 + Prisma — voir api/README-api.md
├── client/     React 19 + Vite — voir client/README-client.md
│               (dont Mascot, MascotWidget, Confetti, joy layer)
├── docker-compose.yml   (développement uniquement)
└── .github/            ci.yml · dependabot.yml
```

Documentation de conception (cahier des charges, Merise, diagrammes, charte graphique, maquettes) : dépôt [`senlis-participatif-docs`](https://github.com/Nathalie-Leduc/senlis-participatif-docs).

## ✅ Qualité

```bash
npm run test --workspace api       # tests d'intégration API (BDD jetable)
npm run test --workspace client    # tests composants
npm run lint --workspaces
```

CI sur chaque PR (lint + tests + build + `npm audit` des dépendances de production) ; Dependabot propose chaque semaine les mises à jour de sécurité. Merge sur `main` = déploiement Clever Cloud. Workflow Git : `main` ← `dev` ← `feat/…`, commits conventionnels, une PR par fonctionnalité (base : `dev`).

## 🔒 Sécurité & RGPD (résumé)

HTTPS · Argon2id · JWT révocables · 2FA admin · validation Zod systématique · Helmet · rate limiting (auth incluse, derrière proxy) · CORS restreint · emails vérifiés avant participation · réponses d'enquête **pseudonymisées** · export et effacement des données en libre-service · purge automatique (comptes inactifs, jetons) · journal des actions admin · polices auto-hébergées, aucun traceur · secret statistique (groupes < 5 masqués). Détail : audit `21` du dépôt docs.

## ♿ Accessibilité

Cible WCAG 2.1 AA. Contrastes vérifiés, navigation clavier complète, skip link, labels visibles. Toutes les animations (mascotte, jauges, confettis) respectent `prefers-reduced-motion` : le site est 100 % fonctionnel sans animation.

## 📜 Licence & contact

MIT — Nathalie Leduc. Projet citoyen indépendant, non affilié à la mairie de Senlis.
