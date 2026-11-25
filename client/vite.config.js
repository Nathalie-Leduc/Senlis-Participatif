import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Plus de réglage `esbuild` (S5R2-08, recette du 25/11) : depuis
  // Vitest 5, les tests passent eux aussi par oxc, comme Vite 8, qui
  // applique seul le JSX « automatique » (composants sans import React).
  // L'ancien `esbuild: { jsx: 'automatic' }`, nécessaire avec Vitest 4,
  // n'était plus lu et affichait « Both esbuild and oxc options were set ».
  css: {
    preprocessorOptions: {
      scss: {
        // loadPaths dit à Sass : "quand tu vois @use 'variables',
        // cherche dans ce dossier". Comme ça, n'importe quel fichier
        // .scss du projet peut faire @use 'variables' as *; sans
        // chemin relatif compliqué (../../styles/variables).
        loadPaths: ['src/styles'],
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Même cible que /api : les images uploadées sont servies par
      // la même API Express (voir app.js), pas un serveur à part.
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
    // S5R2-08 (conseil affiché par Vitest 5) : par défaut, un navigateur
    // simulé (jsdom) était reconstruit pour CHACUN des 67 fichiers de
    // test — la moitié du temps total. Avec « vmThreads », chaque fichier
    // garde son propre bac à sable (isolation conservée), mais jsdom
    // n'est préparé qu'une fois par fil d'exécution : ~50 s → ~11 s.
    // Analogie : on garde une table par élève, mais on ne remonte plus
    // la salle de classe entière à chaque nouvel élève.
    // Si un jour un test échoue SEULEMENT dans ce mode (comparaison
    // « instanceof » entre deux bacs à sable, souvent), le relancer
    // avec « npx vitest run --pool=threads » pour comparer.
    pool: 'vmThreads',
  },
});