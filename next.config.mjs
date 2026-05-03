import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withSentryConfig } from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isMobile = process.env.BUILD_TARGET === 'mobile';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Build cache lives in `.next.nosync` instead of `.next` because this repo
  // sits under iCloud-synced ~/Desktop. iCloud's `bird` daemon evicts files
  // it considers cold, which broke dev with `ENOENT app/page.js` mid-session.
  // The `.nosync` suffix is the documented macOS convention for opting a
  // directory out of iCloud Drive sync.
  //
  // Mobile/static-export builds keep the default `.next` distDir so that
  // `output: 'export'` writes the exported site to `out/` at the project
  // root (the `verify-static-export.sh` script and Capacitor `cap sync`
  // both expect `out/`). The mobile build is a one-shot consumed
  // immediately by gradle, so iCloud eviction during the build window is
  // not a meaningful risk.
  ...(!isMobile && { distDir: '.next.nosync' }),

  // Trace from the monorepo root only at build time. In dev this would force
  // Next's file-system watcher across `backend/`, `packages/`, `infra/`, etc.
  // and was contributing to mid-session manifest invalidations.
  ...(isProd && { outputFileTracingRoot: path.join(__dirname, '..') }),

  poweredByHeader: false,

  // Compression is wasted CPU per HMR response in dev; only enable in prod.
  compress: isProd,

  // Mobile builds use static export for Capacitor
  ...(isMobile && {
    output: 'export',
    trailingSlash: true,
    // Skip ESLint + typecheck during mobile release build so lint-only drift
    // in test/utility files doesn't block producing an on-device APK.
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
  }),

  experimental: {
    // NOTE: All `@radix-ui/*` packages and `lucide-react` are intentionally
    // excluded from `optimizePackageImports`. With `next/dynamic({ ssr: false })`,
    // Next 15.5's barrel optimization rewrites these imports to virtual
    // `__barrel_optimize__` modules. When the barrel target is dual-installed
    // by pnpm (e.g. `@radix-ui/react-slot` resolves to both 1.2.3 and 1.2.4 via
    // different Radix sub-packages), the rewrite emits two webpack module IDs
    // for the same import specifier — one in the parent layout chunk, another
    // in a dynamic chunk. `__webpack_require__(id)` then returns `undefined` in
    // the dynamic chunk → `TypeError: Cannot read properties of undefined
    // (reading 'call')`. The `pnpm.overrides` in the root `package.json` pins
    // `@radix-ui/react-slot` to a single version; this list keeps them out of
    // the barrel rewriter as a belt-and-braces measure for the other Radix pkgs.
    optimizePackageImports: [
      'date-fns',
      '@tanstack/react-query',
      'zod',
      'zustand',
    ],
  },

  images: {
    // Mobile builds cannot use server-side image optimization
    unoptimized: isMobile,
    // Mobile mode: use a pass-through loader so URLs remain stable and the
    // Capacitor WebView disk cache can reuse the underlying asset.
    ...(isMobile && {
      loader: 'custom',
      loaderFile: './src/lib/image-loader.ts',
    }),
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  async headers() {
    // Static export does not support custom headers
    if (isMobile) return [];

    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/v1/services/categories',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/api/v1/promotions',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/api/v1/search/trending',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

const sentryOptions = {
  org: process.env.SENTRY_ORG || 'glamornate',
  project: process.env.SENTRY_PROJECT || 'glamornate-web',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  authToken: process.env.SENTRY_AUTH_TOKEN, // optional; skips sourcemap upload if absent
};

// Skip Sentry's webpack plugin instrumentation in dev. The plugin doesn't
// improve dev experience, prints deprecation warnings on every start, and
// adds work to every HMR compile. Production builds keep full Sentry support.
export default withBundleAnalyzer(
  isProd ? withSentryConfig(nextConfig, sentryOptions) : nextConfig,
);
