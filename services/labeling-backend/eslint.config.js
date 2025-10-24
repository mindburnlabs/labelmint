import serviceConfig from '../../config/shared/eslint.service.config.js'

export default [
  ...serviceConfig,
  {
    ignores: [
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