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

**Front** React 19 · Vite 6 · React Router 7 · Sass · react-leaflet · mascotte SVG inline — **API** Node 22 · Express 5 · Prisma 7 · PostgreSQL · Zod · JWT + Argon2 — **Qualité** Vitest · Testing Library · Supertest · ESLint — **Infra** Docker · GitHub Actions · Railway

Architecture découplée : le front affiche, l'API décide, la base garantit. L'API (`/api/v1`, JSON, documentée Swagger) est consommable telle quelle par une future application mobile.

## 🚀 Démarrage rapide

**Prérequis** : Node ≥ 22, Docker + Docker Compose, Git.

```bash
git clone https://github.com/Nathalie-Leduc/senlis-participatif.git
cd senlis-participatif

# 1. Variables d'environnement
cp api/.env.example api/.env        # compléter (voir api/README.md)
cp client/.env.example client/.env

# 2. Base de données + API (Docker)
docker compose up -d                 # PostgreSQL + API sur :3000

# 3. Migrations + données de démo
cd api && npm install
npx prisma migrate dev
npm run seed                         # admin + proposition + enquête de démo

# 4. Front
cd ../client && npm install
npm run dev                          # http://localhost:5173
```

Comptes de démo (seed) : `admin@demo.local` / `citoyen1@demo.local` — mots de passe dans `api/prisma/seed.js` (dev uniquement).

## 📁 Structure

```
senlis-participatif/
├── api/        Express 5 + Prisma — voir api/README.md
├── client/     React 19 + Vite — voir client/README.md
│               (dont Mascot, MascotWidget, Confetti, joy layer)
├── docker-compose.yml
└── .github/workflows/ci.yml
```

Documentation de conception (cahier des charges, Merise, diagrammes, charte graphique, maquettes) : dépôt [`senlis-participatif-docs`](https://github.com/Nathalie-Leduc/senlis-participatif-docs).

## ✅ Qualité

```bash
npm run test --workspace api       # tests d'intégration API (BDD jetable)
npm run test --workspace client    # tests composants
npm run lint --workspaces
```

CI sur chaque PR (lint + tests + build) ; merge sur `main` = déploiement Railway automatique. Workflow Git : `main` ← `develop` ← `feat/…`, commits conventionnels, une PR par fonctionnalité.

## 🔒 Sécurité & RGPD (résumé)

HTTPS · Argon2 · JWT · validation Zod systématique · Helmet · rate limiting (auth incluse) · CORS restreint · emails vérifiés avant participation · réponses d'enquête **pseudonymisées** (la suppression de compte anonymise sans détruire les statistiques) · droit à l'effacement intégré.

## ♿ Accessibilité

Cible WCAG 2.1 AA. Contrastes vérifiés, navigation clavier complète, skip link, labels visibles. Toutes les animations (mascotte, jauges, confettis) respectent `prefers-reduced-motion` : le site est 100 % fonctionnel sans animation.

## 📜 Licence & contact

MIT — Nathalie Leduc. Projet citoyen indépendant, non affilié à la mairie de Senlis.
