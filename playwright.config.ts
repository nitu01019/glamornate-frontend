import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // QA-M3: retries=1 (down from 2). A spec that flakes twice in a row in CI
  // should be moved to tests/quarantine/ with a linked issue, not masked by
  // a third retry. `trace: 'on-first-retry'` is preserved via the `use` block
  // below (`trace: 'retain-on-failure'` subsumes it for the first retry too).
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'tests/report/playwright-report', open: 'never' }],
    ['json', { outputFile: 'tests/report/playwright-results.json' }],
    ['junit', { outputFile: 'tests/report/playwright-junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Q2: Auth setup runs once and persists storageState to tests/.auth/customer.json
    // so downstream projects can start specs already signed in. The regex is
    // anchored so it only matches the customer setup at `tests/auth.setup.ts`
    // — without the negative-lookahead the spa_owner setup at
    // `tests/e2e/auth.setup.ts` would also run under this project.
    { name: 'setup', testMatch: /tests\/auth\.setup\.ts$/ },

    // E2E-C2 (Phase 3 charlie council correction): a second auth setup that
    // signs in a spa_owner and persists `tests/e2e/.auth/spa-owner.json`.
    // The setup writes a skip-marker storageState when no spa_owner
    // credentials are wired up, so the `chromium-spa` project can boot
    // without a live spa_owner account in CI.
    {
      name: 'setup-spa-owner',
      testMatch: /tests\/e2e\/auth\.setup\.ts$/,
    },

    // E2E-C2: spa-side specs are scoped to `tests/e2e/spa/` and need
    // `chromium-spa` storageState — exclude them from the generic
    // browser projects below so they don't run unauthenticated and fail.
    {
      name: 'chromium',
      testMatch: /tests\/e2e\/.*\.spec\.ts$/,
      testIgnore: /tests\/e2e\/spa\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: /tests\/e2e\/.*\.spec\.ts$/,
      testIgnore: /tests\/e2e\/spa\//,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /tests\/e2e\/.*\.spec\.ts$/,
      testIgnore: /tests\/e2e\/spa\//,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      testMatch: /tests\/e2e\/.*\.spec\.ts$/,
      testIgnore: /tests\/e2e\/spa\//,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      testMatch: /tests\/e2e\/.*\.spec\.ts$/,
      testIgnore: /tests\/e2e\/spa\//,
      use: { ...devices['iPhone 12'] },
    },

    // A4.2: Pre-authenticated customer project. The `__never__` placeholder
    // testMatch from Q2 is replaced with a real glob so customer-tagged specs
    // under `tests/e2e/customer/` actually run. Each spec must have an `@customer`
    // annotation to opt in (Playwright reads the tag from spec text). The
    // dashboard-smoke spec is the seed; new flows go in this directory.
    {
      name: 'customer',
      dependencies: ['setup'],
      testMatch: /tests\/e2e\/customer\/.*\.spec\.ts$/,
      use: {
        ...devices['Pixel 5'],
        storageState: 'tests/.auth/customer.json',
      },
    },

    // E2E-C2: spa-side specs run on a dedicated chromium project that
    // depends on `setup-spa-owner` and consumes the persisted spa_owner
    // storageState. Today this glob is empty; C5 will land specs under
    // `tests/e2e/spa/`. Each spec is expected to read the
    // `__e2e_spa_owner_skip__` localStorage marker and `test.skip()` when
    // no real spa_owner credentials are provisioned (see
    // `tests/e2e/auth.setup.ts` header for the helper pattern).
    {
      name: 'chromium-spa',
      dependencies: ['setup-spa-owner'],
      testMatch: /tests\/e2e\/spa\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/spa-owner.json',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    // QA-M8: feature flags exposed so the v2 surfaces rendered under test
    // match what the specs assert. Without these, the dev server serves the
    // legacy paths and any v2-specific selector times out. Flag names are
    // the canonical NEXT_PUBLIC_* ids from src/lib/flags/*.ts.
    env: {
      NEXT_PUBLIC_HOME_V2_GRID: '1',
      NEXT_PUBLIC_HOME_V2_HERO: '1',
      NEXT_PUBLIC_ADDRESS_SHEET_V2: '1',
      NEXT_PUBLIC_NOTIFICATIONS_FEED_V1: '1',
      // A6: forward a Maps key (or empty string) so deny-path specs can hit
      // MapsKeyMissingFallback cleanly when no key is provided. CI without
      // a real Maps key gets an empty string and the typed-address fallback
      // renders; setting PLAYWRIGHT_MAPS_KEY locally enables the live-Maps
      // path for grant-flow specs that exercise PlaceAutocompleteInput.
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.PLAYWRIGHT_MAPS_KEY ?? '',
    },
  },
})
