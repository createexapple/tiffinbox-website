import { defineConfig, devices } from '@playwright/test';

/**
 * Checks against the REAL backend: the app is started WITHOUT the test mock flag and reads SUPABASE_URL and
 * SUPABASE_PUBLISHABLE_KEY from `.env.local` (loaded by Next.js and, for the E2E_ADMIN_* variables, by
 * `npm run test:e2e:staging`). Staging project only, synthetic data only. Authenticated admin flows need an
 * admin account that the Engineering Lead creates (docs/backend.md); without E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 * they skip with a clear message. The mock suite is `playwright.config.ts`.
 */
const PORT = 3200;

export default defineConfig({
  testDir: './tests/staging',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Never inherit the mock flag from the shell: this suite must exercise the real backend.
    env: { TIFFINBOX_TEST_MOCK_BACKEND: '' },
  },
});
