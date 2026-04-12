import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig([
  {
    ignores: [
      'node_modules',
      '.env',
      'package-lock.json',
      '.gitignore',
      '.eslint.config.mjs',
      '.prettierignore',
      '.prettierrc',
    ],
  },
  {
    languageOptions: {
      globals: globals.node, // better for bots than browser
      sourceType: 'module',
    },
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      js,
      prettier,
    },
    extends: ['js/recommended', prettierConfig],
    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_', // ignore unused function args like _client, _args
          varsIgnorePattern: '^_', // ignore unused variables starting with _
        },
      ],

      'no-console': 'off', // KEEP console.log (correct for bots)

      'no-useless-escape': 'warn', // don’t block builds for this

      // Helpful safety rules
      'no-undef': 'error',
    },
  },
]);
