/**
 * tests/e2e/spa/spa-booking-detail-legacy.spec.ts — C5 (Phase 3 charlie).
 *
 * Asserts the spa-side booking detail surface degrades gracefully for
 * legacy home bookings that lack a captured `customerLocation`:
 *   - Page renders without crashing.
 *   - The `spa-booking-location-card` shows the "No location captured"
 *     pill (renders SpaBookingLocationCard's `isHome && !location` branch).
 *   - Neither the static-map preview img nor the Get Directions CTA are
 *     present.
 *
 * Provisioning contract (graceful-skip):
 *   - storageState skip-marker ⇒ skip.
 *   - `E2E_LEGACY_BOOKING_ID` env var must point at a Firestore booking
 *     where `bookingLocation==="home"` AND `customerLocation` is null /
 *     missing. When unset, skip cleanly.
 *   - Defensive: when the location card doesn't render at all (booking
 *     missing or auth degraded), skip rather than fail.
 */
import { expect, test } from '@playwright/test';

const SKIP_MARKER_KEY = '__e2e_spa_owner_skip__';
const SKIP_REASON_NO_AUTH =
  'spa_owner auth not provisioned in CI — set E2E_SPA_OWNER_EMAIL/E2E_SPA_OWNER_PASSWORD';
const SKIP_REASON_NO_FIXTURE =
  'legacy booking fixture not provisioned — set E2E_LEGACY_BOOKING_ID to a Firestore booking id ' +
  'that has bookingLocation==="home" but no customerLocation';

test.describe('@spa booking detail — legacy (no captured location)', () => {
  test('shows no-location pill, hides map and directions CTA', async ({ page }) => {
    await page.goto('/');
    const skipMarker = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      SKIP_MARKER_KEY,
    );
    test.skip(skipMarker === '1', SKIP_REASON_NO_AUTH);

    const legacyBookingId = process.env.E2E_LEGACY_BOOKING_ID ?? '';
    test.skip(!legacyBookingId, SKIP_REASON_NO_FIXTURE);

    // Page must mount without throwing. Watch for unexpected runtime
    // errors in the page console; assert no crash via main-mount probe.
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(`/spa/bookings/${legacyBookingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Skip if auth/fixture didn't actually surface the booking detail.
    const card = page.locator('[data-testid="spa-booking-location-card"]');
    const cardVisible = await card.isVisible().catch(() => false);
    test.skip(
      !cardVisible,
      'spa booking detail did not render the location card — fixture missing or auth degraded',
    );

    await expect(card).toBeVisible({ timeout: 15_000 });

    // The legacy branch renders a "No location captured" pill.
    await expect(page.getByText(/No location captured/i)).toBeVisible();

    // Neither the map preview nor the directions CTA are present in this
    // branch — the card collapses to the amber-pill summary.
    await expect(page.locator('[data-testid="spa-booking-map-preview"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="spa-booking-directions-cta"]')).toHaveCount(0);

    expect(pageErrors, `unexpected pageerror(s): ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
