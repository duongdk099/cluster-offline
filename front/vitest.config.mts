import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The Nuxt-runtime vitest environment is incompatible with this project's
// Nuxt 3.21 + vitest toolchain, so we test the framework-agnostic logic
// (services, utils, stores) in a plain happy-dom environment instead.
// Nuxt auto-imports those modules rely on are stubbed in test/setup.ts.
const root = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '~': root,
      '@': root,
      '~~': root,
      '@@': root,
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
  },
});
