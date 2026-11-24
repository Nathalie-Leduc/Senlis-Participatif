import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vite 8 utilise oxc (pas esbuild) pour dev/build — un réglage
  // esbuild.jsx s'y appliquerait pour rien et affiche un avertissement
  // ("esbuild options will be ignored") à chaque démarrage. Vitest, lui,
  // passe encore par esbuild pour sa transformation JSX, et EN A besoin
  // (sinon aucun composant .jsx du projet — qui n'importe jamais React
  // explicitement, runtime automatique oblige — n'est transformable).
  // process.env.VITEST n'est défini QUE pendant `vitest run`/`vitest`,
  // jamais pendant `vite`/`vite build` : le réglage ne s'applique donc
  // que là où il sert, silence total ailleurs.
  esbuild: process.env.VITEST ? { jsx: 'automatic' } : undefined,
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