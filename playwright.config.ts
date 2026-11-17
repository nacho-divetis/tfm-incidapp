import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

/**
 * Tests E2E sobre la aplicación compilada (API + SPA en el mismo origen),
 * con una base de datos PostgreSQL embebida en memoria y los datos demo.
 * Ejecutar con `npm run test:e2e` (hace el build antes).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-ES',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /responsive\.spec\.ts/,
      // En local se usa el Chrome instalado; en CI, el Chromium de Playwright.
      use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) },
    },
    {
      name: 'mobile',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['Pixel 7'], ...(process.env.CI ? {} : { channel: 'chrome' }) },
    },
  ],
  webServer: {
    command: 'node apps/api/dist/main.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: 'test',
      DATABASE_URL: 'memory://',
      SEED_DEMO: 'true',
    },
  },
});
