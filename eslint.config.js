import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import checkFile from 'eslint-plugin-check-file';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-size/**',
      'coverage/**',
      'node_modules/**',
      'public/mockServiceWorker.js',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      boundaries,
      'check-file': checkFile,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
      'boundaries/elements': [
        { type: 'pages', pattern: 'src/pages/*', mode: 'folder', capture: ['slice'] },
        { type: 'widgets', pattern: 'src/widgets/*', mode: 'folder', capture: ['slice'] },
        { type: 'features', pattern: 'src/features/*', mode: 'folder', capture: ['slice'] },
        { type: 'entities', pattern: 'src/entities/*', mode: 'folder', capture: ['slice'] },
        { type: 'app', pattern: 'src/app/**' },
        { type: 'shared', pattern: 'src/shared/**' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['pages', 'widgets', 'features', 'entities', 'shared'] },
            {
              from: 'pages',
              allow: [['pages', { slice: '${slice}' }], 'widgets', 'features', 'entities', 'shared'],
            },
            {
              from: 'widgets',
              allow: [['widgets', { slice: '${slice}' }], 'features', 'entities', 'shared'],
            },
            {
              from: 'features',
              allow: [['features', { slice: '${slice}' }], 'entities', 'shared'],
            },
            {
              from: 'entities',
              allow: [['entities', { slice: '${slice}' }], 'shared'],
            },
            { from: 'shared', allow: ['shared'] },
          ],
        },
      ],
      'boundaries/entry-point': [
        'error',
        {
          // Default must be 'disallow': with 'allow', an allow-only rule list never blocks anything.
          default: 'disallow',
          rules: [
            { target: ['app', 'shared'], allow: '**' },
            { target: ['pages', 'widgets', 'features'], allow: 'index.ts' },
            // `mock.ts` is the mock-only entry (MSW handlers, fixtures) for src/app/mocks and tests.
            { target: ['entities'], allow: ['index.ts', 'mock.ts'] },
          ],
        },
      ],
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': ['error', { 'src/**/': 'KEBAB_CASE' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@/pages/*/*',
            '@/widgets/*/*',
            '@/features/*/*',
            '@/entities/*/*',
            '!@/entities/*/mock',
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'flutter_inappwebview',
          message: 'Use the super-app adapter.',
        },
      ],
    },
  },
  {
    files: ['src/shared/super-app/adapters/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/mocks/**', 'src/**/*.test.{ts,tsx}', 'src/shared/test/**', 'src/app/test/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          // Same as the base rule but without the `mock` exception: runtime code must not pull MSW in.
          patterns: ['@/pages/*/*', '@/widgets/*/*', '@/features/*/*', '@/entities/*/*'],
        },
      ],
    },
  },
  prettier,
);
