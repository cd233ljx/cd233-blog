import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Private preview workspaces link src; never execute their copies of tests.
    include: ['src/**/*.test.{ts,tsx,mjs}', 'scripts/**/*.test.{ts,mjs}'],
  },
});
