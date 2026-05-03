import { test, expect } from '@playwright/test';

/**
 * S1 regression test: Home sections refetch on every navigation.
 *
 * Setup: intercept GET /api/v1/services/categories and count calls.
 * Flow: /  -> /account -> /
 * Expectation: the network is hit at most once (first render). On return
 * navigation the persisted/stale-time cache serves the data without
 * triggering a second request.
 */
test.describe('S1 — Home categories cache across navigation', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('navigating home -> account -> home does not refetch categories', async ({ page }) => {
    let categoriesCallCount = 0;

    await page.route('**/api/v1/services/categories*', async (route) => {
      categoriesCallCount += 1;
      await route.continue();
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to account
    await page.goto('/account');
    await page.waitForLoadState('networkidle');

    // Back home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow a brief settling window for any deferred refetches.
    await page.waitForTimeout(1000);

    expect(
      categoriesCallCount,
      `categories endpoint was hit ${categoriesCallCount}x (expected <= 1)`,
    ).toBeLessThanOrEqual(1);
  });
});
