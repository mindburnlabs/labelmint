/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@labelmint/ui', '@labelmint/shared'],
  images: {
    domains: ['localhost', 'api.labelmint.io', 'cdn.labelmint.io'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
  },
};

export default nextConfig;