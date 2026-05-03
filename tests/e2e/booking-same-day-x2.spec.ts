/**
 * Wave 9 W9-E — Same-day double-booking spec.
 *
 * Invariant: a customer who has already booked a 17:00 slot for the
 * current IST day MUST be able to book a 19:00 slot on that same day in
 * the same browser session, and `/customer/bookings` MUST surface both
 * entries within five seconds of the second submission. This regresses
 * the v3.1 fix for "second-booking failures on same day" — the earlier
 * implementation rejected the second submission via stale wizard state
 * and / or stale availability cache.
 *
 * Auth contract: see booking-wizard-reset.spec.ts. Same env-guard skip.
 *
 * Clock: Playwright 1.59 `page.clock.install({ time: '...' })` pins
 * "now" to 2026-05-02T08:30:00Z (== 14:00 IST) so the 17:00 + 19:00
 * slots are deterministically future-relative within IST.
 */
import { test, expect } from '@playwright/test';

const FIXED_NOW_UTC = '2026-05-02T08:30:00Z'; // == 14:00 IST

test.describe('booking same-day x2', () => {
  test('books 17:00 then 19:00 the same IST day; both render in /customer/bookings', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_TEST_USER_EMAIL,
      'requires E2E_TEST_USER_EMAIL fixture; see tests/auth.setup.ts roadmap',
    );

    // Pin the clock before the page boots so React's `new Date()` calls
    // observe the same fixed instant. Playwright 1.59+ API.
    await page.clock.install({ time: FIXED_NOW_UTC });

    // Stub the submission RPC. We track invocation order so the second
    // call can return a distinct booking id.
    const bookingIds: ReadonlyArray<string> = ['same-day-1700', 'same-day-1900'];
    let submissionCount = 0;
    await page.route('**/createBooking**', async (route) => {
      const id = bookingIds[submissionCount] ?? `same-day-${submissionCount}`;
      submissionCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { bookingId: id } }),
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

    // ---- Booking 1 — 17:00 ----
    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Step 1 of 5')).toBeVisible({ timeout: 15_000 });

    await advanceWizardToConfirm(page, '17:00');
    await page.getByRole('button', { name: /Confirm Booking/ }).click();
    await page.waitForURL(new RegExp(`/customer/bookings/${bookingIds[0]}/?$`), {
      timeout: 15_000,
    });

    // ---- Booking 2 — same day, 19:00 ----
    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Step 1 of 5')).toBeVisible({ timeout: 15_000 });

    await advanceWizardToConfirm(page, '19:00');
    await page.getByRole('button', { name: /Confirm Booking/ }).click();
    await page.waitForURL(new RegExp(`/customer/bookings/${bookingIds[1]}/?$`), {
      timeout: 15_000,
    });

    // ---- Verify list freshness within 5s ----
    await page.goto('/customer/bookings');
    await page.waitForLoadState('domcontentloaded');

    // The list view groups bookings under tabs; "Upcoming" is the active
    // tab on entry. Both 17:00 and 19:00 entries are upcoming relative to
    // the pinned 14:00 IST clock, so both must appear there.
    await expect(page.getByText(/5:00\s*PM/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/7:00\s*PM/i)).toBeVisible({ timeout: 5_000 });

    expect(submissionCount).toBe(2);
  });
});

/**
 * Helper: walks the wizard from Step 1 → Step 5 and pauses on Confirm.
 * Caller is responsible for the final `Confirm Booking` click. The slot
 * label argument is matched as a substring against the time-slot
 * button text (e.g. "17:00" matches "5:00 PM" if the rendered buttons
 * use AM/PM, but our seeded availability uses HH:mm — keep the contract
 * simple by passing both forms via regex).
 */
async function advanceWizardToConfirm(
  page: import('@playwright/test').Page,
  slotLabel: string,
): Promise<void> {
  const firstSpa = page.locator('[data-testid="spa-card"], button:has-text("Select")').first();
  if ((await firstSpa.count()) === 0) {
    test.skip(true, 'No spas seeded in test environment');
  }
  await firstSpa.click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Step 2 of 5')).toBeVisible({ timeout: 10_000 });

  const firstService = page.locator('main button').first();
  if ((await firstService.count()) === 0) {
    test.skip(true, 'No services seeded for the selected spa');
  }
  await firstService.click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 10_000 });

  // Today's pill is the first one in the date row.
  const todayPill = page.locator('button[data-testid="date-pill"], main button').first();
  await todayPill.click();
  // Slot button text matches the seeded HH:mm format.
  const slot = page.getByRole('button', { name: new RegExp(slotLabel) });
  if ((await slot.count()) === 0) {
    test.skip(true, `No ${slotLabel} slot available for today`);
  }
  await slot.first().click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Step 4 of 5')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 10_000 });
}
