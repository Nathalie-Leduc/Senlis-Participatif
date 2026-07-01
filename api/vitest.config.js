import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite'; // ← loadEnv vient de vite, pas de vitest/config

export default defineConfig({
  test: {
    environment: 'node',
    env: loadEnv('test', process.cwd(), ''), // charge .env.test
    setupFiles: ['./tests/setup.js'],

    // Tous les tests partagent la MÊME base Postgres. En parallèle
    // (comportement par défaut de Vitest), un fichier pourrait nettoyer
    // la BDD pendant qu'un autre y écrit encore.
    // Analogie : deux cuisiniers, un seul plan de travail → on se cogne.
    // On les fait travailler à tour de rôle.
    fileParallelism: false,

    // Argon2 est volontairement lent + allers-retours Postgres :
    // le timeout par défaut (5s) peut être juste.
    testTimeout: 15000,
  },
});