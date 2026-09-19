import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default defineConfig([
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    linterOptions: {
      noInlineConfig: true,
    },
  },
  {
    files: ['**/*.{js,mjs,ts}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      unicorn.configs.recommended,
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/**/*.{js,ts}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['*.config.{js,mjs,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);