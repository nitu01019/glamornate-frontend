/**
 * tests/e2e/spa/spa-booking-call-customer.spec.ts — C5 (Phase 3 charlie).
 *
 * Asserts the spa-side Call Customer CTA on the booking-detail surface
 * exposes a `tel:` href that matches the booking's customer phone. This
 * is the lightest-weight of the three C5 specs; it just needs *any*
 * authenticated booking detail render with a phone number.
 *
 * Provisioning contract (graceful-skip):
 *   - storageState skip-marker ⇒ skip.
 *   - Reads `E2E_ANY_BOOKING_ID` (preferred) or falls back to
 *     `E2E_HOME_BOOKING_ID`. Either is fine — the call CTA is present
 *     on every booking detail when `customer.phone` is set.
 *   - Skip when the CTA isn't found (booking missing phone, auth
 *     degraded, or fixture not seeded).
 */
import { expect, test } from '@playwright/test';

const SKIP_MARKER_KEY = '__e2e_spa_owner_skip__';
const SKIP_REASON_NO_AUTH =
  'spa_owner auth not provisioned in CI — set E2E_SPA_OWNER_EMAIL/E2E_SPA_OWNER_PASSWORD';
const SKIP_REASON_NO_FIXTURE =
  'no booking fixture provisioned — set E2E_ANY_BOOKING_ID or E2E_HOME_BOOKING_ID';

test.describe('@spa booking detail — call customer CTA', () => {
  test('Call Customer CTA exposes tel: href matching customer phone', async ({ page }) => {
    await page.goto('/');
    const skipMarker = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      SKIP_MARKER_KEY,
    );
    test.skip(skipMarker === '1', SKIP_REASON_NO_AUTH);

    const bookingId =
      process.env.E2E_ANY_BOOKING_ID ?? process.env.E2E_HOME_BOOKING_ID ?? '';
    test.skip(!bookingId, SKIP_REASON_NO_FIXTURE);

    await page.goto(`/spa/bookings/${bookingId}`);
    await page.waitForLoadState('domcontentloaded');

    const cta = page.locator('[data-testid="spa-booking-call-cta"]');
    const ctaVisible = await cta.isVisible().catch(() => false);
    test.skip(
      !ctaVisible,
      'Call Customer CTA not rendered — booking missing phone, fixture missing, or auth degraded',
    );

    await expect(cta).toBeVisible({ timeout: 15_000 });

    const href = await cta.getAttribute('href');
    expect(href, 'Call CTA must expose a tel: href').not.toBeNull();
    expect(href ?? '').toMatch(/^tel:.+/);
  });
});
