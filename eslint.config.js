// Lint for the TypeScript code (#39): the recommended rules of ESLint and typescript-eslint.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['node_modules/', 'test-results/', 'playwright-report/', 'coleta/carga/__fixtures__/']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
    rules: {
      // Raw JSON from external APIs is untyped by nature; the loaders check the fields they use.
      '@typescript-eslint/no-explicit-any': 'off',
      // `const { a, ...rest } = x` to drop a field is the idiom used in the tests.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
]);
