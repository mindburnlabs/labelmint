import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Build optimizations
  build: {
    target: 'ES2022',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          telegram: ['@telegram-apps/sdk', '@telegram-apps/telegram-ui'],
        },
      },
    },
  },

  // Development server
  server: {
    port: 3000,
    strictPort: false,
    open: false,
  },

  // Preview server
  preview: {
    port: 4173,
    strictPort: false,
  },

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/assets': resolve(__dirname, './src/assets'),
      '@/config': resolve(__dirname, './src/config'),
      '@/api': resolve(__dirname, './src/api'),
      '@/store': resolve(__dirname, './src/store'),
      '@/contexts': resolve(__dirname, './src/contexts'),
      '@/constants': resolve(__dirname, './src/constants'),
    },
  },

  // Environment variables
  envPrefix: 'VITE_',

  // CSS configurations
  css: {
    devSourcemap: true,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
