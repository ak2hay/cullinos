import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@cullinos/shared', '@cullinos/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@cullinos/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@cullinos/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    };

    config.module.rules.push({
      test: /\.svg$/i,
      type: 'asset/resource',
    });

    return config;
  },
};

export default nextConfig;
