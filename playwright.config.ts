import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Production build, as visitors get it. Needs no secrets and no network except font download at build.
    // The test-only flag serves the in-memory mock instead of Supabase (src/lib/env.ts isMockBackend); it is
    // read at request time, so this is the same build artifact. Real-backend checks: playwright.staging.config.ts.
    command: `npm run build && npm run start -- --port ${PORT}`,
    env: { TIFFINBOX_TEST_MOCK_BACKEND: '1' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
