import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['./test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-tests-0123456789',
      CORS_ORIGIN: 'http://localhost:5173',
      APP_URL: 'http://localhost:5173',
    },
    testTimeout: 20_000,
    hookTimeout: 120_000,
    // Each file gets its own database, so files can run in parallel.
    fileParallelism: true,
  },
});
