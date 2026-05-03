import { test, expect, Route } from '@playwright/test';

/**
 * S3 — Mobile search entry point regression guard.
 *
 * Baseline (commit a023230) proved there was NO reachable search entry
 * point on the Pixel 5 home viewport — no magnifier in the header, no
 * Search item in the bottom nav. This test proves the home page now
 * exposes a reachable search trigger AND that clicking a trending chip
 * propagates the chip text into the URL `q` param (which is what the
 * React-Query key consumes in `useUnifiedSearch`).
 *
 * Note: because the backend is not deployed yet, result-set distinctness
 * cannot be asserted here — we intercept `/api/v1/search/trending` to
 * deterministically inject the chips we depend on.
 */

const TRENDING_CHIPS = [
  { query: 'waxing', label: 'Waxing', icon: 'sparkles' },
  { query: 'massage', label: 'Massage', icon: 'hand' },
];

test.describe('S3 — Mobile search entry point + chip propagation', () => {
  test.use({ viewport: { width: 393, height: 851 } }); // Pixel 5

  test.beforeEach(async ({ page }) => {
    // Deterministic trending chips so the test does not depend on backend.
    await page.route('**/api/v1/search/trending**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: TRENDING_CHIPS }),
      });
    });
    // Stub the results endpoint so the chip navigation doesn't spin forever.
    await page.route('**/api/v1/search**', async (route: Route) => {
      const url = new URL(route.request().url());
      if (
        url.pathname.includes('/search/trending') ||
        url.pathname.includes('/search/suggestions')
      ) {
        await route.continue();
        return;
      }
      const q = url.searchParams.get('q') ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: `svc-${q || 'empty'}-1`, name: `${q} result`, type: 'service' }],
          error: null,
          meta: { total: 1, page: 1, limit: 20 },
        }),
      });
    });
  });

  test('search entry point reachable from home + chip propagates to ?q=', async ({ page }) => {
    // 1. Land on home
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 2. The search trigger must be tappable on Pixel 5 viewport.
    const searchTrigger = page.getByTestId('home-search-trigger');
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click();

    // 3. We should land on the /search route.
    await page.waitForURL(/\/search/);
    await expect(page).toHaveURL(/\/search/);

    // 4. The trending chip for "waxing" should be present with its testid.
    const waxingChip = page.getByTestId('trending-chip-waxing');
    await expect(waxingChip).toBeVisible();
    await waxingChip.click();

    // 5. URL must contain the chip text in the q param — this is the only
    //    way `useUnifiedSearch` can differentiate cache entries between
    //    chips, which is what the backing query key requires.
    await page.waitForURL(/\/search\?.*q=waxing/);
    await expect(page).toHaveURL(/\/search\?.*q=waxing/);
  });

  test('fallback a11y query finds the search trigger by role', async ({ page }) => {
    // Belt-and-suspenders: this covers the spec-style selector from the task.
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    await expect(searchButton).toBeVisible();
  });
});
