import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws when imported outside a React server build; unit tests run in plain Node.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Public content tests read the labelled sample content, never the network (src/lib/env.ts isMockBackend).
    env: { TIFFINBOX_TEST_MOCK_BACKEND: '1' },
  },
});
