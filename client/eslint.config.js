import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        confirm: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // vite.config.js (et tout futur *.config.js à la racine) s'exécute
    // dans Node au moment du build/dev — jamais dans le navigateur.
    // Le reste de ce fichier ne déclare QUE des globales navigateur
    // (document, window...), donc `process` y était inconnu — même
    // catégorie de problème que FormData plus tôt, mais dans l'autre
    // sens (globale Node manquante plutôt que navigateur manquante).
    files: ['*.config.js'],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
];
