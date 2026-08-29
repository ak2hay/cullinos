import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@cullinos/sync': path.resolve(__dirname, 'packages/sync/src/index.ts'),
      '@cullinos/tax-engine': path.resolve(__dirname, 'packages/tax-engine/src/index.ts'),
      '@cullinos/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@cullinos/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
    },
  },
  test: {
    include: [
      'apps/api/src/**/*.test.ts',
      'packages/sync/src/**/*.test.ts',
      'packages/tax-engine/src/**/*.test.ts',
    ],
  },
});
