import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Rend les variables et mixins accessibles dans tous les modules Sass
        // sans import explicite — DRY (Don't Repeat Yourself)
        additionalData: `@use "src/styles/variables" as *; @use "src/styles/mixins" as *;`,
      },
    },
  },
  server: {
    port: 5173,
    // Proxy vers l'API en dev pour éviter les problèmes CORS
    proxy: {
      '/api': {
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
