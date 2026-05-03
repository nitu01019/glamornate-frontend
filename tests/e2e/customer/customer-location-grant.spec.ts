/**
 * @customer A6 customer-location grant spec.
 *
 * Walks the post-A5 5-step wizard at /customer/book-new through to the
 * Confirm Location step, toggles the "At your address" radio, and asserts:
 *   - the geolocation grant resolves to an emitted GPS BookingCustomerLocation
 *   - the createBookingDraft callable receives `bookingLocation: 'home'` and
 *     `customerLocation.source === 'gps'`
 *
 * Auth: inherited via the `customer` Playwright project's storageState.
 *
 * Data: createBookingDraft + createPaymentIntent are stubbed via page.route
 * so the spec doesn't depend on Firestore-emulator-seeded spas/services.
 * The earlier wizard steps (spa pick, services, schedule) require live
 * data — when no spas surface, the spec test.skips with a reason.
 *
 * Network capture: a request listener on ``createBookingDraft`` records the
 * outbound payload. We assert against `request.postDataJSON()` after
 * confirming the listener fired.
 */
import { expect, test } from '@playwright/test';

const BLR_LAT = 12.9716;
const BLR_LNG = 77.5946;

test.describe('@customer customer-location grant', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'permissions + setGeolocation are most reliable on Chromium',
  );

  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: BLR_LAT, longitude: BLR_LNG },
  });

  test('GPS grant emits gps-source customerLocation in createBookingDraft', async ({
    page,
  }) => {
    // Stub callable RPCs so the spec is independent of live Firestore data
    // for the booking creation step. Spas/services data still needs to be
    // seeded for the earlier steps; we test.skip below if not.
    let createBookingDraftBody: Record<string, unknown> | null = null;
    await page.route('`createBookingDraft`**', async (route) => {
      const post = route.request().postDataJSON?.();
      // Firebase callable wraps payload as `{ data: <actualPayload> }`.
      createBookingDraftBody = (post?.data as Record<string, unknown>) ?? null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: { bookingId: 'test-booking-id-grant' },
        }),
      });
    });
    await page.route('**/createPaymentIntent**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            clientSecret: 'pi_test_secret',
            amount: 1000,
            paymentIntentId: 'pi_test_id',
          },
        }),
      });
    });

    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForLoadState('networkidle').catch(() => {});
    const onWizard = await page.evaluate(
      () => window.location.pathname === '/customer/book-new',
    );
    test.skip(
      !onWizard,
      'storageState did not authenticate; check tests/auth.setup.ts',
    );

    // Step 1 — Select Spa. Pick the first spa card; skip when no seeded spas.
    const firstSpaCard = page.locator('[data-testid="spa-card"], button:has-text("Select")').first();
    const fallbackSpaCard = page.locator('main button').first();
    const spaCard = (await firstSpaCard.count()) > 0 ? firstSpaCard : fallbackSpaCard;
    if ((await spaCard.count()) === 0) {
      test.skip(true, 'No spas seeded in test environment');
    }
    await spaCard.click();
    // Continue button advances to step 2.
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 2 of 5')).toBeVisible({ timeout: 10_000 });

    // Step 2 — Choose Services. Pick the first service.
    const firstService = page.locator('main button').first();
    if ((await firstService.count()) === 0) {
      test.skip(true, 'No services seeded for the selected spa');
    }
    await firstService.click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 10_000 });

    // Step 3 — Pick Time. Pick first available date/slot.
    const firstDate = page.locator('button[data-testid="date-pill"], main button').first();
    await firstDate.click();
    const firstSlot = page.locator('button:has-text(":")').first();
    if ((await firstSlot.count()) === 0) {
      test.skip(true, 'No slots available for the selected date/spa');
    }
    await firstSlot.click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 4 of 5')).toBeVisible({ timeout: 10_000 });

    // Step 4 — Confirm Location. Toggle to "At your address".
    await page.getByRole('radio', { name: /At your address/i }).click();
    // Click "Allow" to consume the geolocation grant.
    await page.getByRole('button', { name: /^Allow$/ }).click();

    // Map render OR fallback typed-mode. With Maps key + permission grant
    // the app should render the LocationMapPin map element.
    await expect(
      page.locator('div').filter({ hasText: /Selected:/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Continue to step 5.
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 10_000 });

    // Step 5 — Confirm. Submit. The page.route listener captures payload.
    const requestPromise = page.waitForRequest('`createBookingDraft`**');
    await page.getByRole('button', { name: /Confirm Booking/ }).click();
    await requestPromise;

    expect(createBookingDraftBody).not.toBeNull();
    const body = createBookingDraftBody as Record<string, unknown>;
    expect(body['bookingLocation']).toBe('home');
    const customerLocation = body['customerLocation'] as {
      source?: string;
      coords?: { lat: number; lng: number };
    } | undefined;
    expect(customerLocation).toBeTruthy();
    expect(customerLocation?.source).toBe('gps');
  });
});
