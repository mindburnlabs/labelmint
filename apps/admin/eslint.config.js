import sharedConfig from '../../config/shared/eslint.config.js'
import nextPlugin from '@next/eslint-plugin-next'

export default [
  ...sharedConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/no-unescaped-entities': 'off',
      '@next/next/no-page-custom-font': 'off'
    }
  },
  {
    ignores: [
      '.next/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      '.nyc_output/**',
      '.vscode/**',
      '.idea/**'
    ]
  }
]