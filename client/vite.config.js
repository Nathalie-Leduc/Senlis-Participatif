import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  },
});