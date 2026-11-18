/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:5000';

  return {
    plugins: [react()],
    // Excalidraw checks this at runtime.
    define: { 'process.env.IS_PREACT': JSON.stringify('false') },
    server: {
      port: 5173,
      // Same-origin in development: the refresh cookie works without SameSite=None.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    build: {
      sourcemap: true,
      // The board route (Excalidraw) and MathJax are lazy-loaded chunks; they're large by nature.
      chunkSizeWarningLimit: 3000,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      // Tests must not depend on a developer's local .env.
      env: { VITE_API_BASE_URL: '', VITE_SOCKET_URL: '', VITE_GOOGLE_CLIENT_ID: '', VITE_SENTRY_DSN: '' },
      css: false,
    },
  };
});
