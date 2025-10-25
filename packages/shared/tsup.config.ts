import { defineConfig } from 'tsup'
import { readdirSync } from 'fs'
import { join } from 'path'

// Get all entry points from src directory
const getEntryPoints = () => {
  const srcDir = join(__dirname, 'src')
  const entries: Record<string, string> = {}

  // Add main index
  entries.index = join(srcDir, 'index.ts')

  // Scan subdirectories for index files
  const dirs = readdirSync(srcDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  dirs.forEach(dir => {
    const indexPath = join(srcDir, dir, 'index.ts')
    try {
      require.resolve(indexPath)
      entries[dir] = indexPath
    } catch {
      // No index file in this directory
    }
  })

  return entries
}

export default defineConfig({
  entry: getEntryPoints(),
  format: ['cjs', 'esm'],
  dts: {
    resolve: true
  },
  clean: true,
  external: [
    'react',
    'react-dom',
    'pg',
    'ioredis',
    'grammy',
    '@ton/core',
    '@ton/crypto',
    '@ton/ton'
  ],
  sourcemap: true,
  minify: false,
  target: 'es2020',
  onSuccess: 'echo "Build completed successfully"'
})