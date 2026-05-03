import { test, expect, Route } from '@playwright/test';

/**
 * Regression test for S3 (trending chips returning identical results).
 *
 * We intercept /api/v1/search?q=... and return a unique result payload
 * per query so the only way the UI can render "distinct result sets"
 * is if the URL query string actually propagates from the chip click to
 * the fetch call (i.e. the query key includes `q`).
 */

type MockResult = {
  id: string;
  name: string;
  type: string;
};

const RESULTS_BY_QUERY: Record<string, MockResult[]> = {
  massage: [
    { id: 'svc-massage-1', name: 'Swedish Massage', type: 'service' },
    { id: 'svc-massage-2', name: 'Deep Tissue Massage', type: 'service' },
  ],
  facial: [
    { id: 'svc-facial-1', name: 'Glow Facial', type: 'service' },
    { id: 'svc-facial-2', name: 'Anti-Ageing Facial', type: 'service' },
  ],
  manicure: [
    { id: 'svc-manicure-1', name: 'Classic Manicure', type: 'service' },
    { id: 'svc-manicure-2', name: 'Gel Manicure', type: 'service' },
  ],
};

const TRENDING_CHIPS = [
  { query: 'massage', label: 'Massage', icon: 'hand' },
  { query: 'facial', label: 'Facial', icon: 'sparkles' },
  { query: 'manicure', label: 'Manicure', icon: 'user' },
];

test.describe('Trending-chip search flow (S3)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('clicking different trending chips yields distinct result sets', async ({ page }) => {
    // Intercept trending endpoint — deterministic chips.
    await page.route('**/api/v1/search/trending**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: TRENDING_CHIPS }),
      });
    });

    // Intercept the search endpoint — distinct payload per `q` param.
    await page.route('**/api/v1/search**', async (route: Route) => {
      const url = new URL(route.request().url());
      // Skip non-search sibling routes.
      if (
        url.pathname.includes('/search/trending') ||
        url.pathname.includes('/search/suggestions')
      ) {
        await route.continue();
        return;
      }
      const q = url.searchParams.get('q') ?? '';
      const data = RESULTS_BY_QUERY[q] ?? [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data,
          error: null,
          meta: { total: data.length, page: 1, limit: 20 },
        }),
      });
    });

    const seenByChip: Record<string, string> = {};

    for (const chip of TRENDING_CHIPS) {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');

      const chipButton = page.getByRole('button', {
        name: new RegExp(`search for ${chip.label}`, 'i'),
      });
      await expect(chipButton).toBeVisible();
      await chipButton.click();

      // Wait for URL to carry the query and for the response to paint.
      await page.waitForURL(new RegExp(`/search\\?.*q=${encodeURIComponent(chip.query)}`));

      // Assert the unique result name renders.
      const expected = RESULTS_BY_QUERY[chip.query][0].name;
      const resultLocator = page.getByText(expected, { exact: false }).first();
      await expect(resultLocator).toBeVisible({ timeout: 10_000 });

      seenByChip[chip.query] = expected;
    }

    const uniqueTexts = new Set(Object.values(seenByChip));
    expect(uniqueTexts.size).toBe(TRENDING_CHIPS.length);
  });
});
