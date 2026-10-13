import type { NextConfig } from 'next';
import path from 'path';

function r2RemotePattern(): { protocol: 'https'; hostname: string; pathname: string } | null {
  const raw = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return {
      protocol: 'https',
      hostname: url.hostname,
      pathname: '/**',
    };
  } catch {
    return null;
  }
}

const r2Pattern = r2RemotePattern();

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: https://challenges.cloudflare.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  // No includeSubDomains until every *.cullinos.com host is confirmed HTTPS-only.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@cullinos/shared', '@cullinos/ui'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      ...(r2Pattern ? [r2Pattern] : []),
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
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
