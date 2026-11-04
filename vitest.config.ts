import { defineConfig } from 'vitest/config';

// Coverage thresholds mirror docs/CONSTRAINTS.md; that file wins if they ever disagree.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // The entry file only mounts React; dev-only test hooks never ship.
      exclude: ['src/main.tsx', 'src/dev/**'],
      reporter: ['text-summary', 'lcov'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
        'src/core/**': { lines: 95, branches: 95, functions: 95, statements: 95 },
      },
    },
  },
});
