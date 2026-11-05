import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Rule suppressions would let checks be silenced instead of fixed (CLAUDE.md §7).
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // zod must come from src/core/zod.ts, which turns off its eval probe before any schema is built (Task 24).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/core/zod.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'zod', message: "Import { z } from 'src/core/zod.ts' (CSP: no eval)." }],
        },
      ],
    },
  },
  {
    files: ['tools/**/*.{ts,mjs}', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
