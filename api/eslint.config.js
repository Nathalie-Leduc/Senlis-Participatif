import js from '@eslint/js';

export default [
  {
    // Code généré par "prisma generate" — jamais écrit à la main,
    // jamais à mettre aux normes ESLint du projet. Doit être le
    // PREMIER élément du tableau : en flat config, un objet qui ne
    // contient QUE "ignores" s'applique globalement, à toute la
    // config, plutôt que de fusionner des règles avec un pattern de
    // fichiers.
    ignores: ['src/generated/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off', // autorisé côté API (logs serveur)
    },
  },
];
