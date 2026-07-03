import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Le React Compiler ne tourne PAS au build (vite = @vitejs/plugin-react
      // sans babel-plugin-react-compiler). La règle preserve-manual-memoization,
      // promue en `error` dans le preset `recommended` par le bump v5→v7
      // (commit 039f73f), double `exhaustive-deps` (déjà `warn`) et n'apporte
      // aucune garantie runtime ici → rétrogradée en `warn` pour ne pas casser
      // le lint/CI, tout en gardant le signal « compiler-ready ».
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Convention : un identifiant préfixé par `_` est intentionnellement
      // inutilisé (arg de signature à conserver, var ignorée, erreur catchée).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  }
);
