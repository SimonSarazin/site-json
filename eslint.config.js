import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      // Bundle du design-system : sortie machine, gitignorée (.gitignore:54), 0
      // fichier suivi. Elle portait 25 des 29 erreurs du dépôt — toutes du type
      // « Definition for rule X was not found », car ces fichiers embarquent des
      // `eslint-disable` visant des règles que NOTRE config ne charge pas.
      'ds-bundle',
      // Aires de rendu design-sync. ⚠ `previews/` contient 153 `.tsx` SUIVIS et
      // écrits à la main : les ignorer les soustrait durablement au lint. Choix
      // assumé — cf. le rapport de session, une seule erreur y dormait
      // (variable `seq2` morte dans previews/SearchBubbleChart.tsx).
      '.design-sync',
    ],
  },
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
  },
  {
    // `react-refresh` ne parle que du rafraîchissement à chaud en développement.
    // Les utilitaires de test ne sont jamais rechargés à chaud : la règle n'y a
    // aucun sens, et elle ne sait de toute façon pas analyser un `export *`
    // (tests/test-utils-ui.tsx est un barrel délibéré). Désactivée ICI plutôt
    // qu'en `eslint-disable` local, qui laisserait croire à une dette.
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  }
);
