/** @type {import('prettier').Config} */
export default {
  arrowParens: 'avoid',
  bracketSameLine: false,
  bracketSpacing: true,
  singleQuote: true,
  semi: false,
  tabWidth: 2,
  trailingComma: 'none',
  useTabs: false,
  endOfLine: 'lf',
  printWidth: 100,
  quoteProps: 'as-needed',
  jsxSingleQuote: true,
  bracketSpacing: true,
  proseWrap: 'preserve',
  htmlWhitespaceSensitivity: 'css',
  embeddedLanguageFormatting: 'auto',
  insertPragma: false,
  requirePragma: false,
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always'
      }
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    },
    {
      files: '*.yaml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    }
  ]
}