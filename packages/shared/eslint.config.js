import sharedConfig from '../../config/shared/eslint.config.js';

export default [
  ...sharedConfig,
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
];