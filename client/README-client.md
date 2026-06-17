# Client — Senlis Participatif

> React 19 + Vite 6. SPA mobile-first, accessible (cible RGAA / WCAG 2.1 AA), écoresponsable, **joyeuse** (mascotte cerf animée, sections colorées, micro-interactions). Ne contient **aucune** logique métier critique : tout est validé et décidé côté API.

## Démarrage

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:3000/api/v1
npm run dev              # http://localhost:5173
```

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de dev Vite (HMR) |
| `npm run build` | Build de production (`dist/`) |
| `npm run preview` | Prévisualisation du build |
| `npm test` | Vitest + Testing Library |
| `npm run lint` | ESLint (config React + a11y) |

## Structure

```
src/
├── pages/         Une page = une route (Accueil, Propositions, Enquetes, Admin…)
├── components/    Réutilisables, co-localisés (X.jsx + X.module.scss + X.test.jsx)
│   ├── Header/
│   ├── Footer/
│   ├── VoteBar/           Jauge tricolore animée au scroll
│   ├── MapView/           Carte Leaflet (import dynamique lazy)
│   ├── SurveyForm/        Parcours une-question-par-écran
│   ├── Mascot/            🦌 SVG inline, 4 tailles (hero/section/inline/widget)
│   ├── MascotWidget/      Panneau guide-citoyen flottant
│   ├── Confetti/          Pluie de confettis au vote
│   └── Toast/             Messages de confirmation éphémères
├── hooks/
│   ├── useAuth.js         Contexte JWT
│   ├── useFetch.js        Fetch wrapper
│   └── useScrollReveal.js Déclenche les animations au scroll (IntersectionObserver)
├── services/      api.js — UNIQUE point de contact avec l'API
├── assets/        mascot-poses.svg (source des 4 poses du cerf)
└── styles/
    ├── variables.scss     Palette complète (base + Joy Layer)
    ├── mixins.scss        Breakpoints mobile-first
    ├── _animations.scss   Keyframes : blink, earWiggle, tailWag, bubblePop, float, pulse
    ├── _mascot.scss       Tailles, poses, bulles de parole du cerf
    └── _joy-layer.scss    Sections colorées, séparateurs ondulés, stat pills, effets de survol
```

**Règle d'or** : aucun composant ne fait de `fetch` direct — tout passe par `services/api.js` (gestion centralisée du jeton, des erreurs, de la base d'URL).

## Charte graphique (rappel du code)

Variables Sass dans `styles/variables.scss` — source : charte graphique « la pierre, la rivière et le cerf ».

```scss
// Palette principale
$ardoise: #26333A;  $pierre: #FDF9F0;  $nonette: #1E5F7C;
$tilleul: #3A7A4D;  $brique: #A8442F;  $gris: #6B6257;  $dore: #D4A84A;

// Joy Layer (sections colorées)
$nonette-light: #E3F0F6;  $tilleul-light: #E0F2E5;
$dore-light: #FFF4DB;      $brique-light: #FCEAE6;
$dore-bright: #F0C45A;     $tilleul-bright: #4CAF65;
$nonette-glow: #2A8AB4;

// Typo : Fraunces (titres, 500/700/800) · Public Sans (texte, base 18px)
// Breakpoints mobile-first : @include from(tablet) { … }  // 768px, 1024px
// Rayon : 16px boutons, 32px cartes
```

## La mascotte (composant `Mascot`)

Le cerf est un **SVG inline** : zéro requête réseau, stylable en CSS, animable sans JavaScript. Le composant `Mascot` accepte une prop `size` (`hero` | `section` | `inline` | `widget`) et une prop optionnelle `speech` (bulle de texte). Les animations CSS (clignement, oreilles, queue) sont définies dans `_animations.scss` et respectent `prefers-reduced-motion`.

## Check-list accessibilité (à vérifier sur chaque PR)

- [ ] Navigable entièrement au clavier, focus visible (anneau Nonette 3 px)
- [ ] Skip link « Aller au contenu » fonctionnel
- [ ] Un `<h1>` par page, hiérarchie de titres sans saut
- [ ] Labels de formulaire visibles (jamais de placeholder-comme-label)
- [ ] La couleur ne porte jamais seule l'information (icône/texte en plus)
- [ ] Images : `alt` pertinent + `loading="lazy"` sous la ligne de flottaison
- [ ] **`prefers-reduced-motion` respecté** pour toute animation (mascotte, jauges, confettis, compteurs)
- [ ] Mascotte et éléments décoratifs : `aria-hidden="true"` ; mascotte hero : `role="img"` + `aria-label`
- [ ] Widget guide-citoyen : navigable au clavier, boutons avec labels explicites, panneau fermable

## Cartographie

`MapView` encapsule react-leaflet (fonds OSM, périmètres GeoJSON, couche IRIS statique dans `public/geo/`). La carte est chargée en lazy (import dynamique) : elle ne pèse rien tant qu'elle n'est pas affichée — performance et éco-conception.
