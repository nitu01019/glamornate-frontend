import { test, expect } from '@playwright/test';

/**
 * Booking flow E2E.
 *
 * Phase 1 / Task 1.1 (spec-fe-2, 2026-05-08): the legacy /booking wizard
 * was deleted (SC-11, V-7). The sole surviving booking entry point is
 * /customer/book-new. The 5-step progress + label assertions below target
 * that new wizard. Direct-load 404 lock for /booking lives in
 * `tests/e2e/legacy-booking-deleted.spec.ts`.
 *
 * Auth: the new wizard is `<ProtectedRoute requiredRoles={['customer']}>` —
 * specs that need to render the wizard interior live under
 * tests/e2e/customer/ where Playwright's `customer` project hands them an
 * authenticated storageState. Specs in this file run un-authed and use
 * `test.skip` when ProtectedRoute redirects them away from the wizard.
 */

test.describe('Booking Flow', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('legacy /booking returns 404 (post Task 1.1 deletion)', async ({ page }) => {
    // SC-11: the legacy wizard at /booking was deleted in Phase 1 Task 1.1.
    // Ensures the route is not silently re-introduced — the canonical 404
    // lock spec is `legacy-booking-deleted.spec.ts`; this is the parity
    // entry kept inside the booking-flow describe block for visibility.
    const response = await page.goto('/booking', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
  });

  test('booking page step labels are defined correctly', async ({ page }) => {
    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');
    // Wait for ProtectedRoute to settle: either it rendered the wizard
    // (pathname stays /customer/book-new) or it redirected (typically to
    // /auth/login?callbackUrl=...). Check pathname rather than full URL
    // because the callbackUrl query param contains "book-new" too.
    await page.waitForLoadState('networkidle').catch(() => {});
    const onWizard = await page.evaluate(() => window.location.pathname === '/customer/book-new');

    test.skip(
      !onWizard,
      'Wizard is auth-gated; rendered-interior coverage lives in tests/e2e/customer/',
    );

    // Step labels match post-A5 STEP_TITLES exactly (src/app/customer/book-new/page.tsx).
    const stepLabels = [
      'Select Spa',
      'Choose Services',
      'Pick Time',
      'Confirm Location',
      'Confirm',
    ];
    for (const label of stepLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // Step counter renders "Step 1 of 5" on initial load.
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
  });

  test('booking page with cart items shows first step on entry', async ({ page }) => {
    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');
    // Wait for ProtectedRoute to settle: either it rendered the wizard
    // (pathname stays /customer/book-new) or it redirected (typically to
    // /auth/login?callbackUrl=...). Check pathname rather than full URL
    // because the callbackUrl query param contains "book-new" too.
    await page.waitForLoadState('networkidle').catch(() => {});
    const onWizard = await page.evaluate(() => window.location.pathname === '/customer/book-new');

    test.skip(
      !onWizard,
      'Wizard is auth-gated; rendered-interior coverage lives in tests/e2e/customer/',
    );

    // First step is "Select Spa"; step counter confirms it.
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
  });

  test('cart empty-state surfaces on /customer/book-new entry', async ({ page }) => {
    // Pre-Task-1.1 this spec asserted the legacy /booking wizard's
    // empty-cart CTA ("Your cart is empty" + Browse Services link). The
    // legacy wizard was deleted (SC-11); the new wizard at
    // /customer/book-new is auth-gated. Un-authed visits redirect to
    // /auth/login — the spec skips when ProtectedRoute redirects, mirroring
    // the gating used by the other tests in this describe block. The 404
    // assertion for /booking lives in the first test of this file.
    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle').catch(() => {});

    const onWizard = await page.evaluate(() => window.location.pathname === '/customer/book-new');
    test.skip(
      !onWizard,
      'Wizard is auth-gated; un-authed sessions hit the login redirect (covered in auth specs).',
    );

    // The new wizard's first step is "Select Spa"; the counter confirms it.
    await expect(page.getByText('Step 1 of 5')).toBeVisible({ timeout: 10_000 });
  });

  test('booking progress indicator has 5 steps', async ({ page }) => {
    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');
    // Wait for ProtectedRoute to settle: either it rendered the wizard
    // (pathname stays /customer/book-new) or it redirected (typically to
    // /auth/login?callbackUrl=...). Check pathname rather than full URL
    // because the callbackUrl query param contains "book-new" too.
    await page.waitForLoadState('networkidle').catch(() => {});
    const onWizard = await page.evaluate(() => window.location.pathname === '/customer/book-new');

    test.skip(
      !onWizard,
      'Wizard is auth-gated; rendered-interior coverage lives in tests/e2e/customer/',
    );

    // Post-A5 the wizard renders 5 progress segments via StepIndicator.
    const stepCircles = page.getByTestId('booking-progress-step');
    await expect(stepCircles.first()).toBeVisible();
    await expect(stepCircles).toHaveCount(5);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Adds the first available service to cart via the services → category →
 * detail flow. Q1-clean: uses `expect().toBeVisible()` to assert state
 * instead of the pass-when-absent conditional-visibility anti-pattern.
 *
 * Test.skip is used when the catalog is empty (which happens in some test
 * environments) — that case is legitimately flag-gated by catalog seed
 * state, not a UI regression.
 */
async function addFirstServiceToCart(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/services');
  await page.waitForLoadState('domcontentloaded');

  const firstCategoryLink = page.locator('.grid a').first();
  await expect(firstCategoryLink).toBeVisible({ timeout: 10000 });
  await firstCategoryLink.click();
  await page.waitForLoadState('domcontentloaded');

  const addButton = page.getByRole('button', { name: /Add/ }).first();
  await expect(addButton).toBeVisible({ timeout: 10000 });
  await addButton.click();
}
