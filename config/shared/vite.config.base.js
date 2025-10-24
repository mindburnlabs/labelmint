/**
 * Shared Vite configuration base for all LabelMint applications
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export const baseViteConfig = {
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
          router: ['react-router-dom'],
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
      '@': resolve(__dirname, '../../../src'),
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
};

export default baseViteConfig;