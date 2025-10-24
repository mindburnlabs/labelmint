import sharedConfig from './eslint.config.js'

export default [
  ...sharedConfig,
  {
    files: ['**/*.{ts,js}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        queueMicrotask: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        WeakMap: 'readonly',
        WeakSet: 'readonly',
        Proxy: 'readonly',
        Reflect: 'readonly',
        BigInt: 'readonly',
        // Node.js specific globals
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        globalThis: 'readonly'
      }
    },
    rules: {
      // Service-specific rules
      'no-console': 'off', // Allow console in services
      '@typescript-eslint/no-require-imports': 'off', // Allow require imports
      '@typescript-eslint/no-var-requires': 'off', // Allow var requires
      'import/no-dynamic-require': 'off' // Allow dynamic requires
    }
  }
]