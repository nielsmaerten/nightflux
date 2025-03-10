import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  {
    ignores: [
      'node_modules',
      'dist',
    ],
  },
  {
    plugins: {
      '@stylistic': stylistic,
    },
  },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  stylistic.configs.recommended,
  stylistic.configs.customize({
    semi: true,
  }),
];
