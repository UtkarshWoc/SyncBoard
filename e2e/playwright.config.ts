import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const API_PORT = 5099;
const WEB_PORT = 5199;
const DB_PORT = 27019;
const external = process.env.E2E_MONGODB_URI;
const mongoUri = external ?? `mongodb://127.0.0.1:${DB_PORT}/syncboard_e2e`;
const root = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: [
    ...(external
      ? []
      : [
          {
            name: 'mongo',
            command: 'npx tsx backend/scripts/memory-db.ts',
            cwd: root,
            port: DB_PORT,
            env: { DEV_DB_PORT: String(DB_PORT), DEV_DB_PATH: path.join(os.tmpdir(), `syncboard-e2e-${Date.now()}`) },
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
          },
        ]),
    {
      name: 'api',
      command: 'npx tsx backend/src/server.ts',
      cwd: root,
      url: `http://localhost:${API_PORT}/api/health/ready`,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        MONGODB_URI: mongoUri,
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        APP_URL: `http://localhost:${WEB_PORT}`,
        JWT_ACCESS_SECRET: 'e2e-secret-that-is-long-enough-0123456789abcdef',
        SMTP_URL: '',
        GOOGLE_CLIENT_ID: '',
        LOG_LEVEL: 'warn',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      name: 'web',
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: path.join(root, 'frontend'),
      url: `http://localhost:${WEB_PORT}`,
      env: {
        VITE_DEV_API_TARGET: `http://localhost:${API_PORT}`,
        VITE_API_BASE_URL: '',
        VITE_SOCKET_URL: '',
        VITE_GOOGLE_CLIENT_ID: '',
        VITE_E2E: 'true',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
