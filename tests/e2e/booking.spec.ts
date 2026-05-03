import { test, expect } from '@playwright/test';

/**
 * Booking flow E2E.
 *
 * A6: post-A5 the wizard at /customer/book-new is a 5-step flow with the
 * `Confirm Location` step inserted between `Pick Time` and `Confirm`.
 * Step labels track `STEP_TITLES` in src/app/customer/book-new/page.tsx.
 *
 * The legacy /booking route still owns cart-driven empty-state semantics
 * and is asserted only for the redirect/empty-state path. The 5-step
 * progress + label assertions target the new wizard.
 *
 * Auth: the new wizard is `<ProtectedRoute requiredRoles={['customer']}>` —
 * specs that need to render the wizard interior live under
 * tests/e2e/customer/ where Playwright's `customer` project hands them an
 * authenticated storageState. Specs in this file run un-authed and use
 * `test.skip` when ProtectedRoute redirects them away from the wizard.
 */

test.describe('Booking Flow', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('booking page loads and shows step indicator', async ({ page }) => {
    // Post-A5 the legacy /booking page renders an empty-state CTA (rather
    // than redirecting) when the cart is empty. The page resolves to one
    // of: a step-indicator (cart non-empty), the empty-state CTA, or a
    // redirect target — all valid "loaded" states.
    await page.goto('/booking');
    await page.waitForLoadState('domcontentloaded');

    const stepIndicator = page.getByText(/Step \d+ of \d+/);
    const emptyStateHeading = page.getByText('Your cart is empty');
    const browseCta = page.getByRole('link', { name: /Browse Services/i });

    await expect(stepIndicator.or(emptyStateHeading).or(browseCta).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('booking page step labels are defined correctly', async ({ page }) => {
    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');
    // Wait for ProtectedRoute to settle: either it rendered the wizard
    // (pathname stays /customer/book-new) or it redirected (typically to
    // /auth/login?callbackUrl=...). Check pathname rather than full URL
    // because the callbackUrl query param contains "book-new" too.
    await page.waitForLoadState('networkidle').catch(() => {});
    const onWizard = await page.evaluate(
      () => window.location.pathname === '/customer/book-new',
    );

    test.skip(
      !onWizard,
      'Wizard is auth-gated; rendered-interior coverage lives in tests/e2e/customer/',
    );

    // Step labels match post-A5 STEP_TITLES exactly (src/app/customer/book-new/page.tsx).
    const stepLabels = ['Select Spa', 'Choose Services', 'Pick Time', 'Confirm Location', 'Confirm'];
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
    const onWizard = await page.evaluate(
      () => window.location.pathname === '/customer/book-new',
    );

    test.skip(
      !onWizard,
      'Wizard is auth-gated; rendered-interior coverage lives in tests/e2e/customer/',
    );

    // First step is "Select Spa"; step counter confirms it.
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
  });

  test('booking page surfaces empty-cart CTA when cart is empty', async ({ page }) => {
    // Post-A5 /booking renders an empty-state CTA (not a redirect) when
    // the cart has no items. Assert the empty-state copy + Browse CTA.
    await page.goto('/booking');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Your cart is empty')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /Browse Services/i })).toBeVisible();
  });

  test('booking progress indicator has 5 steps', async ({ page }) => {
    await page.goto('/customer/book-new');
    await page.waitForLoadState('domcontentloaded');
    // Wait for ProtectedRoute to settle: either it rendered the wizard
    // (pathname stays /customer/book-new) or it redirected (typically to
    // /auth/login?callbackUrl=...). Check pathname rather than full URL
    // because the callbackUrl query param contains "book-new" too.
    await page.waitForLoadState('networkidle').catch(() => {});
    const onWizard = await page.evaluate(
      () => window.location.pathname === '/customer/book-new',
    );

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
