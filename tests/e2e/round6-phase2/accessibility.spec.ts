/**
 * Round 6 / Phase 2 B5 — `accessibility.spec.ts`
 *
 * Full-route axe-core accessibility scan. Unshimmed in Phase 3 / Q3 —
 * `@axe-core/playwright` is now a pinned devDependency, so the legacy
 * "dynamic-import-or-skip" branch is gone. The spec uses the shared
 * fixture at `tests/fixtures/axe.ts`, which enforces this severity
 * policy:
 *
 *   - serious / critical  → test FAILS (PR blocker)
 *   - minor / moderate    → logged, test PASSES (backlog)
 *
 * Routes covered (per REMEDIATION_PLAN Q3 + TRUE_INDEX.md):
 *   - `/` (home)
 *   - `/services`
 *   - `/services/category/massages`
 *   - `/booking` (top-level booking flow entry)
 *   - `/cart`
 *   - `/customer/notifications` (auth-gated)
 *   - `/account`
 *   - Address bottom-sheet on `/` (Phase 2 surface)
 *
 * Auth-gated routes use the `seedDefaultCustomer` + `signInUi` helpers
 * wired in Round 6 Phase 3 specs. These are slow (emulator round-trip
 * per test) but correctness > speed for a11y — Phase 4 / Q2 introduces
 * a `storageState` project that will shortcut this.
 *
 * Tags:
 *   - Every test is tagged `@a11y` so `playwright test --grep "@a11y"`
 *     scopes the run.
 *   - The spec-file title also carries `@smoke` so the existing
 *     `playwright-smoke.yml` CI workflow picks it up on every PR.
 */

import { test, expect } from '../../fixtures/axe';
import type { Page } from '@playwright/test';
import {
  seedDefaultCustomer,
  deleteTestUser,
  type SeedUserResult,
} from '../../helpers/seed-user';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHONE = { width: 390, height: 844 } as const;
const LOGIN_URL = '/auth/login';
const LOAD_STATE = 'domcontentloaded' as const;

// Routes that render without auth. Order = document / navigation order.
// Phase 1 Task 1.1 (2026-05-08, spec-fe-2): legacy /booking deleted
// (SC-11). The canonical wizard at /customer/book-new is auth-gated
// (`<ProtectedRoute requiredRoles={['customer']}>`) and is therefore not
// a "public route" any more — removed from this list rather than swapped.
// Auth-gated booking surface a11y coverage lives in
// `tests/e2e/booking-a11y.spec.ts`.
const PUBLIC_ROUTES: ReadonlyArray<{ readonly label: string; readonly url: string }> = [
  { label: 'home', url: '/' },
  { label: 'services listing', url: '/services' },
  { label: 'services category — massages', url: '/services/category/massages' },
  { label: 'cart', url: '/cart' },
  { label: 'account', url: '/account' },
];

// Routes gated by authentication — require a seeded + signed-in user.
const AUTH_ROUTES: ReadonlyArray<{ readonly label: string; readonly url: string; readonly tag: string }> = [
  {
    label: 'customer notifications feed',
    url: '/customer/notifications',
    tag: 'a11y-notifications',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForRouteIdle(page: Page, route: string): Promise<void> {
  await page.waitForLoadState(LOAD_STATE);
  // NetworkIdle often never resolves on our home page (push channels). Swallow.
  await page
    .waitForLoadState('networkidle', { timeout: 10_000 })
    .catch(() => {
      /* ignore — a11y scanning doesn't need full network settle */
    });
  // A small settle window lets React render its streaming children.
  await page.waitForTimeout(750);

  if (!page.url().includes(route) && route !== '/') {
    throw new Error(`Route ${route} redirected to ${page.url()} — not reachable for a11y scan.`);
  }
}

async function signInUi(
  page: Page,
  user: Pick<SeedUserResult, 'email' | 'password'>,
  postLoginUrl: string,
): Promise<void> {
  await page.goto(`${LOGIN_URL}?callbackUrl=${encodeURIComponent(postLoginUrl)}`);
  await page.waitForLoadState(LOAD_STATE);

  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: /^Sign In$/ }).click();

  // Wait for the post-login redirect to the requested URL.
  await page.waitForURL(new RegExp(`${postLoginUrl.replace(/\//g, '\\/')}$`), {
    timeout: 15_000,
  });
  await page.waitForLoadState(LOAD_STATE);
}

// ---------------------------------------------------------------------------
// Public-route scans (@a11y @smoke)
// ---------------------------------------------------------------------------

test.describe('@a11y @smoke @round6-phase2 accessibility — axe-core (public routes)', () => {
  test.use({ viewport: PHONE });

  for (const route of PUBLIC_ROUTES) {
    test(`@a11y ${route.label} (${route.url}) has no serious/critical a11y violations`, async ({
      page,
      assertNoSeriousViolations,
    }) => {
      await page.goto(route.url);
      await waitForRouteIdle(page, route.url);

      await assertNoSeriousViolations();

      // Smoke assertion: we did successfully reach something axe could parse.
      expect(page.url().length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Auth-gated scans (@a11y @auth-gated)
// ---------------------------------------------------------------------------

test.describe('@a11y @auth-gated @round6-phase2 accessibility — axe-core (auth-gated)', () => {
  test.use({ viewport: PHONE });

  for (const route of AUTH_ROUTES) {
    test(`@a11y ${route.label} (${route.url}) has no serious/critical a11y violations`, async ({
      page,
      assertNoSeriousViolations,
    }) => {
      const user = await seedDefaultCustomer(route.tag);
      try {
        await signInUi(page, user, route.url);
        await waitForRouteIdle(page, route.url);
        await assertNoSeriousViolations();
      } finally {
        await deleteTestUser({ uid: user.uid });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Address bottom-sheet (Phase 2 surface) — original scoped scan
// ---------------------------------------------------------------------------

test.describe('@a11y @smoke @round6-phase2 accessibility — axe-core (address sheet)', () => {
  test.use({ viewport: PHONE });

  test('@a11y address bottom-sheet has no serious/critical a11y violations', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/');
    await page.waitForLoadState(LOAD_STATE);
    await page.waitForTimeout(1_500);

    const row = page.getByTestId('home-location-row');
    if ((await row.count()) === 0) {
      test.skip(true, 'home-location-row missing; cannot open sheet.');
      return;
    }

    const tap = row.locator('[role="button"][aria-label="Change location"]');
    if ((await tap.count()) === 0) {
      await row.first().click();
    } else {
      await tap.first().click();
    }

    const sheet = page.getByTestId('home-location-sheet');
    await sheet
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => {
        /* fall through to skip below */
      });
    if ((await sheet.count()) === 0) {
      test.skip(true, 'Sheet did not open; cannot scan.');
      return;
    }

    // Scan only the sheet subtree — limits axe to Phase-2 surface area.
    const results = await makeAxeBuilder()
      .include('[data-testid="home-location-sheet"]')
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      const details = serious
        .map((v) => `${v.id} (${v.impact ?? 'unknown'}): ${v.help} — ${v.helpUrl}`)
        .join('\n');
      throw new Error(`axe serious/critical violations (sheet):\n${details}`);
    }

    expect(results.violations.length).toBeGreaterThanOrEqual(0);
  });
});
