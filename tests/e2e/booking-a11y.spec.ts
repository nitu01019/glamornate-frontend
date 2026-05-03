/**
 * Wave 9 W9-E — Booking surface a11y spec.
 *
 * Invariant: `/customer/bookings` and `/customer/bookings/[id]` MUST have
 * zero `serious` or `critical` axe violations. `moderate` and `minor`
 * findings are logged for follow-up but do not gate CI — see
 * `tests/fixtures/axe.ts` for the shared severity policy.
 *
 * Auth contract: same as the rest of W9-E. Skips when no E2E_TEST_USER_EMAIL.
 *
 * Booking id: deterministic placeholder. The detail route at
 * `src/app/customer/bookings/[id]/page.tsx` declares
 * `generateStaticParams` returning `[{ id: '_' }]`, so `_` is guaranteed
 * to render the client shell even without a backing Firestore document.
 * That's the right level for an a11y scan: we want axe to evaluate the
 * skeleton + error UI markup, not a specific booking's data.
 */
import { test, expect } from '../fixtures/axe';

// `expect` is re-exported from the axe fixture so future assertions in
// this file (or extensions of it) don't need a second import. Keep it
// imported even when the body uses only fixture-attached helpers.
void expect;

const PLACEHOLDER_BOOKING_ID = '_';

test.describe('booking a11y', () => {
  test.beforeEach(async () => {
    test.skip(
      !process.env.E2E_TEST_USER_EMAIL,
      'requires E2E_TEST_USER_EMAIL fixture; see tests/auth.setup.ts roadmap',
    );
  });

  test('/customer/bookings has no serious or critical a11y violations', async ({
    page,
    assertNoSeriousViolations,
  }) => {
    await page.goto('/customer/bookings');
    await page.waitForLoadState('domcontentloaded');
    // Wait for the post-auth-resolve render so axe scans the real list
    // surface rather than the loading skeleton's transient markup.
    await expect(page.getByRole('heading', { name: /My Bookings/i })).toBeVisible({
      timeout: 15_000,
    });
    await assertNoSeriousViolations();
  });

  test('/customer/bookings/[id] has no serious or critical a11y violations', async ({
    page,
    assertNoSeriousViolations,
  }) => {
    await page.goto(`/customer/bookings/${PLACEHOLDER_BOOKING_ID}`);
    await page.waitForLoadState('domcontentloaded');
    // The detail page resolves to one of: loaded card, error state, or
    // not-found state. All three are valid surfaces to scan; we pick
    // `<main>` as the universal anchor.
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await assertNoSeriousViolations();
  });
});

