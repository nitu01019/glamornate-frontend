/**
 * @customer A6 customer-location deny spec.
 *
 * Walks the post-A5 5-step wizard at /customer/book-new through to the
 * Confirm Location step with geolocation explicitly denied, then verifies
 * the typed-address fallback path:
 *   - typed/address mode renders (PlaceAutocompleteInput OR
 *     MapsKeyMissingFallback depending on the Maps key state)
 *   - createBookingDraft receives `customerLocation.source === 'address_typed'`
 *
 * Chromium-only: clearPermissions and the granular geolocation toggle
 * Playwright exposes are reliably supported only on Chromium. The spec
 * skips on Firefox and WebKit.
 *
 * The spec gates Maps presence via `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` —
 * playwright.config.ts forwards `process.env.PLAYWRIGHT_MAPS_KEY ?? ''`,
 * so when no real key is supplied the spec hits MapsKeyMissingFallback,
 * fills the manual form, and submits.
 */
import { expect, test } from '@playwright/test';

test.describe('@customer customer-location deny', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'clearPermissions + geolocation override are Chromium-only',
  );

  test.use({
    permissions: [],
  });

  test('permission denied → address_typed payload via typed fallback', async ({
    page,
  }) => {
    let createBookingDraftBody: Record<string, unknown> | null = null;
    await page.route('**/createBookingDraft**', async (route) => {
      const post = route.request().postDataJSON?.();
      createBookingDraftBody = (post?.data as Record<string, unknown>) ?? null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: { bookingId: 'test-booking-id-deny' },
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

    // Belt-and-braces: even though `test.use({ permissions: [] })` should
    // cover this, explicit clearPermissions guards against state leaked
    // from the storageState fixture.
    await page.context().clearPermissions();

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

    // Step 1 — Select Spa.
    const firstSpaCard = page.locator('[data-testid="spa-card"], button:has-text("Select")').first();
    const fallbackSpaCard = page.locator('main button').first();
    const spaCard = (await firstSpaCard.count()) > 0 ? firstSpaCard : fallbackSpaCard;
    if ((await spaCard.count()) === 0) {
      test.skip(true, 'No spas seeded in test environment');
    }
    await spaCard.click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 2 of 5')).toBeVisible({ timeout: 10_000 });

    // Step 2 — Choose Services.
    const firstService = page.locator('main button').first();
    if ((await firstService.count()) === 0) {
      test.skip(true, 'No services seeded for the selected spa');
    }
    await firstService.click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 10_000 });

    // Step 3 — Pick Time.
    const firstDate = page.locator('button[data-testid="date-pill"], main button').first();
    await firstDate.click();
    const firstSlot = page.locator('button:has-text(":")').first();
    if ((await firstSlot.count()) === 0) {
      test.skip(true, 'No slots available for the selected date/spa');
    }
    await firstSlot.click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 4 of 5')).toBeVisible({ timeout: 10_000 });

    // Step 4 — Confirm Location. Toggle "At your address".
    await page.getByRole('radio', { name: /At your address/i }).click();

    // With NEXT_PUBLIC_GOOGLE_MAPS_API_KEY empty, BookingLocationStep renders
    // MapsKeyMissingFallback directly (no GPS prompt). Fill the manual form.
    const fullAddress = page.locator('#map-fb-full-address');
    const pincode = page.locator('#map-fb-pincode');
    const city = page.locator('#map-fb-city');

    if ((await fullAddress.count()) > 0) {
      // MapsKeyMissingFallback path.
      await fullAddress.fill('123 MG Road, Indiranagar');
      await pincode.fill('560038');
      await city.fill('Bengaluru');
      await page.getByRole('button', { name: /Confirm address/i }).click();
    } else {
      // Maps-available + permission denied path: BookingLocationStep
      // surfaces "Type address" pre-prompt, then PlaceAutocompleteInput.
      const typeAddressBtn = page.getByRole('button', { name: /Type address/i });
      if ((await typeAddressBtn.count()) > 0) {
        await typeAddressBtn.click();
      } else {
        // Allow → permission denied → fallback-typed flow.
        await page.getByRole('button', { name: /^Allow$/ }).click();
      }
      await expect(
        page.locator('input[placeholder*="address" i]').first(),
      ).toBeVisible({ timeout: 10_000 });
      await page
        .locator('input[placeholder*="address" i]')
        .first()
        .fill('123 MG Road, Indiranagar, Bengaluru, 560038');
      // PlaceAutocompleteInput requires a suggestion-pick to emit; without
      // a real Maps key it falls through to MapsKeyMissingFallback. If we
      // got here without that fallback, the spec needs a real Maps key.
      test.skip(
        true,
        'Live Maps key required for autocomplete pick; set PLAYWRIGHT_MAPS_KEY',
      );
    }

    // Continue to step 5.
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 10_000 });

    // Submit.
    const requestPromise = page.waitForRequest('**/createBookingDraft**');
    await page.getByRole('button', { name: /Confirm Booking/ }).click();
    await requestPromise;

    expect(createBookingDraftBody).not.toBeNull();
    const body = createBookingDraftBody as Record<string, unknown>;
    expect(body['bookingLocation']).toBe('home');
    const customerLocation = body['customerLocation'] as {
      source?: string;
    } | undefined;
    expect(customerLocation).toBeTruthy();
    expect(customerLocation?.source).toBe('address_typed');
  });
});
