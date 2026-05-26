// Flat config (ESLint 9+) — reemplaza al viejo .eslintrc.
// Solo aplica a src/, ignora node_modules/dist/build/etc por default.
import js              from '@eslint/js'
import react           from 'eslint-plugin-react'
import reactHooks      from 'eslint-plugin-react-hooks'
import reactRefresh    from 'eslint-plugin-react-refresh'
import globals         from 'globals'

export default [
  // Base recomendada de ESLint
  js.configs.recommended,

  // Reglas + globals para JS/JSX del proyecto
  {
    files:   ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType:  'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks':   reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React 18+ con JSX runtime nuevo: no hace falta importar React
      'react/react-in-jsx-scope':       'off',
      'react/prop-types':               'off',
      'react-hooks/rules-of-hooks':     'error',
      'react-hooks/exhaustive-deps':    'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Quality of life
      'no-unused-vars': ['warn', {
        argsIgnorePattern:    '^_',
        varsIgnorePattern:    '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-empty':       ['warn', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
    },
  },
]
