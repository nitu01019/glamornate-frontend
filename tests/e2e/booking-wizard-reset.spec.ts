/**
 * Wave 9 W9-E — Booking wizard reset spec.
 *
 * Invariant: after a successful booking lands on `/customer/bookings/[id]`,
 * pressing the browser back button MUST render a fresh wizard at step 1
 * with no spa selected, no services chosen, and the step counter reading
 * "Step 1 of 5". This is the regression test for Issue D in the booking
 * flow fix v3.1 plan, where the wizard previously remembered the
 * just-submitted state and presented a fully-populated form to the user.
 *
 * Auth contract:
 *   - When `E2E_TEST_USER_EMAIL` (and a paired password) is provided, the
 *     spec runs end-to-end. The fixture roadmap that wires this env var to
 *     a real Auth-emulator-backed customer user is tracked alongside the
 *     existing `tests/auth.setup.ts` Q2 fixture.
 *   - Without the env var the spec test.skips so CI doesn't fail today.
 *
 * Tag: `@smoke` — picked up by `playwright test --grep @smoke` runs.
 */
import { test, expect } from '@playwright/test';

test.describe.parallel('@smoke booking wizard reset', () => {
  test('returns to step 1 with empty state after success then goBack', async ({ page }) => {
    test.skip(
      !process.env.E2E_TEST_USER_EMAIL,
      'requires E2E_TEST_USER_EMAIL fixture; see tests/auth.setup.ts roadmap',
    );

    // Stub callable RPCs so the spec is independent of live Firestore data
    // and Stripe. The submission RPC resolves with a known booking id we
    // can pin the URL assertion against.
    const submittedBookingId = 'wizard-reset-booking-id';
    await page.route('**/createBooking**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: { bookingId: submittedBookingId },
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
    await expect(page.getByText('Step 1 of 5')).toBeVisible({ timeout: 15_000 });

    // Walk the wizard. Selectors mirror tests/e2e/customer/customer-location-grant.spec.ts
    // so any structural change reverberates across both specs.
    const firstSpaCard = page.locator('[data-testid="spa-card"], button:has-text("Select")').first();
    if ((await firstSpaCard.count()) === 0) {
      test.skip(true, 'No spas seeded in test environment');
    }
    await firstSpaCard.click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 2 of 5')).toBeVisible({ timeout: 10_000 });

    const firstService = page.locator('main button').first();
    if ((await firstService.count()) === 0) {
      test.skip(true, 'No services seeded for the selected spa');
    }
    await firstService.click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 10_000 });

    const firstDate = page.locator('button[data-testid="date-pill"], main button').first();
    await firstDate.click();
    const firstSlot = page.locator('button:has-text(":")').first();
    if ((await firstSlot.count()) === 0) {
      test.skip(true, 'No slots available for the selected date/spa');
    }
    await firstSlot.click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 4 of 5')).toBeVisible({ timeout: 10_000 });

    // Step 4 — accept the default location to keep the spec deterministic.
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 10_000 });

    // Submit — wizard.reset() runs in onSuccess and router.replace lands
    // us on the detail page. Use a regex tolerant of trailing slashes.
    await page.getByRole('button', { name: /Confirm Booking/ }).click();
    await page.waitForURL(new RegExp(`/customer/bookings/${submittedBookingId}/?$`), {
      timeout: 15_000,
    });

    // The invariant: hardware back returns to a fresh wizard.
    await page.goBack();
    await page.waitForURL(/\/customer\/book-new\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('domcontentloaded');

    // Step 1 of 5 — fresh wizard.
    await expect(page.getByText('Step 1 of 5')).toBeVisible({ timeout: 10_000 });
    // No spa selected: the title for step 1 ("Select Spa") still reads as
    // the active step rather than a populated summary.
    await expect(page.getByText('Select Spa', { exact: true }).first()).toBeVisible();
    // The Continue button on a fresh wizard is disabled until a spa is
    // chosen — assert that, not its presence, since the button always
    // exists in the layout.
    const continueButton = page.getByRole('button', { name: /Continue/ });
    await expect(continueButton).toBeDisabled();
  });
});
