// ══════════════════════════════════════════════════════════
// ESLint — client React (S5A-08)
//
// Bug corrigé : l'ancienne configuration ne déclarait aucune clé
// `files`. ESLint 9 (« flat config ») ne lint alors QUE les fichiers
// .js par défaut : TOUS les .jsx — c'est-à-dire toutes les pages et
// tous les composants — étaient ignorés en silence (« File ignored
// because no matching configuration was supplied »). `npm run lint`
// répondait « tout va bien »… sans avoir regardé l'essentiel du code.
//
// Analogie : un correcteur d'orthographe réglé sur « anglais » qui
// ne signale aucune faute dans un texte en français — le silence ne
// prouvait rien.
// ══════════════════════════════════════════════════════════

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/'] },

  js.configs.recommended,

  // ── Code de l'application (navigateur) ────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // Toutes les globales du navigateur (document, window, Blob,
      // FormData…) plutôt qu'une liste tenue à la main, qu'il fallait
      // compléter à chaque nouvelle API utilisée.
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Indispensable avec du JSX : sans cette règle, ESLint ne voit
      // pas que <Mascot /> UTILISE l'import Mascot, et signale à tort
      // « 'Mascot' is defined but never used » sur chaque composant.
      'react/jsx-uses-vars': 'error',
      // ── eslint-plugin-react-hooks 7 (mise à jour Dependabot, 10/2026) ──
      // La version 7 ajoute les règles du « React Compiler », dont
      // set-state-in-effect : elle signale tout setState appelé
      // directement dans un useEffect. Le motif le plus courant du projet
      // (« setLoading(true) puis appel à l'API » au chargement d'une page)
      // en fait partie : 18 occurrences, toutes fonctionnelles et testées.
      // Les réécrire (hook de chargement commun, ou React Query) est un
      // vrai chantier — issue dédiée au backlog — pas une correction à
      // glisser dans une PR qui n'a rien à voir.
      // En attendant : AVERTISSEMENT (visible au lint, ne bloque pas la CI)
      // plutôt que règle désactivée — on garde la liste sous les yeux.
      // Analogie : le voyant « révision bientôt » du tableau de bord —
      // on ne le débranche pas, on prend rendez-vous.
      'react-hooks/set-state-in-effect': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // ── Tests : exécutés par Vitest dans Node (process, fs…) ──
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test-setup.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // ── Fichiers de configuration (vite.config.js…) : Node ────
  {
    files: ['*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
