import { defineConfig } from 'vitest/config';

/**
 * `.mts` so Vite loads it as ESM (the project itself is CommonJS-flagged for
 * Next.js). Path aliases come from `tsconfig.json` via `resolve.tsconfigPaths`.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
});
