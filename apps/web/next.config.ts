import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@cullinos/shared', '@cullinos/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@cullinos/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@cullinos/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    };
    return config;
  },
};

export default nextConfig;
