/** @type {import('@lhci/cli/src/types/lhci.js').LHCIConfig} */
// Mobile preset companion to `lighthouserc.js`. Run via `pnpm lighthouse:mobile`.
// Targets the same URLs but with the LHCI default mobile form-factor +
// throttling so we measure both desktop and mobile in CI.
module.exports = {
  ci: {
    collect: {
      url: [
        'https://glamornate.vercel.app/',
        'https://glamornate.vercel.app/services',
        'https://glamornate.vercel.app/services/category/massages',
        'https://glamornate.vercel.app/cart',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'mobile',
        throttlingMethod: 'simulate',
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Core Web Vitals thresholds — mobile is the primary user form factor,
        // so we keep the same budgets as desktop (Phase 4 F1 perf plan).
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
