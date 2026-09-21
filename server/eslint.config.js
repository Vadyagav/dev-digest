// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'clones/**',
      'src/vendor/**',
      'src/db/migrations/**',
      'scratch-*.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Prefixing with `_` is the established way to mark an intentionally
      // unused parameter/catch binding in this codebase.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `any` shows up at real adapter/DB boundaries (raw driver rows, JSON
      // trace blobs) — flag it as a nudge, not a build-breaker.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
