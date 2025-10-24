const baseConfig = require('../../config/shared/next.config.base.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...baseConfig,
  transpilePackages: ['@labelmint/ui', '@labelmint/shared'],
  images: {
    domains: ['localhost', 'api.labelmint.io', 'cdn.labelmint.io'],
  },
  env: {
    ...baseConfig.env,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
  },
};

module.exports = nextConfig;