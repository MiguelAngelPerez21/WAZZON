import type { NextConfig } from 'next';

import { IMAGE_ALLOWED_HOSTS } from './src/config/images';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    // Deliberately narrow: a full script-src CSP needs per-request nonces and
    // is tracked as a follow-up (see SECURITY.md).
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Pin the workspace root: there is a stray lockfile in the parent directory,
  // and without this Turbopack would try to infer the home folder as the root.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: IMAGE_ALLOWED_HOSTS.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
    })),
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
