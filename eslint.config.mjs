import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Coding standard: no `any` without a comment explaining why.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'design/**',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;
