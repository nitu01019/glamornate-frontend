/** @type {import('@lhci/cli/src/types/lhci.js').LHCIConfig} */
// Default desktop preset. For mobile measurements run `pnpm lighthouse:mobile`
// (uses `lighthouserc.mobile.cjs`); use `pnpm lighthouse:all` to measure both.
module.exports = {
  ci: {
    collect: {
      // URLs are typically injected by CI against a Vercel preview.
      // These production URLs are a fallback for local `pnpm lighthouse` runs
      // and can be overridden with `--collect.url=http://localhost:3000`.
      url: [
        'https://glamornate.vercel.app/',
        'https://glamornate.vercel.app/services',
        'https://glamornate.vercel.app/services/category/massages',
        'https://glamornate.vercel.app/cart',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttlingMethod: 'simulate',
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Core Web Vitals thresholds (mobile-targeted budgets — see Phase 4 F1 perf plan)
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'interactive': ['warn', { maxNumericValue: 3500 }],
        // Bundle budgets (warnings only until we ratchet in Phase 4+)
        'resource-summary:script:size': ['warn', { maxNumericValue: 250000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }],
        // Loosen these audits — app has known gaps that Phase 4 F1 RSC conversion fixes
        'uses-rel-preconnect': 'warn',
        'unused-javascript': 'warn',
        'unused-css-rules': 'warn',
        'render-blocking-resources': 'warn',
        'non-composited-animations': 'off',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
