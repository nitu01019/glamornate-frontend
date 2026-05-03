import { test, expect, devices, type Page } from '@playwright/test';

/**
 * Round 3 P2-A5 smoke suite — validates the home refactor contract:
 *   - P2-A1 stale ElitePromoStrip copy is gone
 *   - P2-A3 renders exactly 13 category tiles
 *   - P2-A2 FeaturedCategoryTile exposes an animated label w/ curtain anim
 *   - P2-A2 single location surface (no duplicate brand/MapPin chrome)
 *   - P2-A2 featured tile uses Blush Premium (bg-brand-pink-50)
 *
 * Pixel 5 viewport (393x851) matches the mobile-first production target and
 * the Round 2 smoke harness convention.
 */

test.use({ ...devices['Pixel 5'], viewport: { width: 393, height: 851 } });
test.describe.configure({ mode: 'serial' });

async function settle(page: Page, extraMs = 4_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(extraMs);
}

test.describe('Round 3 — Home refactor smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settle(page);
  });

  test('(a) does NOT render stale "exclusive member offers" copy', async ({ page }) => {
    // ElitePromoStrip was removed in P2-A2. Its headline copy must not appear
    // anywhere in the DOM — case-insensitive to catch re-additions from any
    // casing variant.
    const stale = page.getByText(/exclusive member offers/i);
    await expect(stale).toHaveCount(0);
  });

  test('(b) renders exactly 13 category-card tiles', async ({ page }) => {
    const cards = page.locator('[data-testid="category-card"]');
    await expect(cards).toHaveCount(13);
  });

  test('(c) featured tile renders an animated label using the curtain-up animation', async ({
    page,
  }) => {
    const animatedLabels = page.locator('[data-testid="featured-animated-label"]');
    const count = await animatedLabels.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // At least one descendant of any animated label must carry the
    // `animate-curtain-up` class (applied on the decorative curtain span).
    const firstAnimated = animatedLabels.first();
    const curtain = firstAnimated.locator('.animate-curtain-up');
    expect(await curtain.count()).toBeGreaterThanOrEqual(1);
  });

  test('(d) renders at most ONE visible location/brand surface', async ({ page }) => {
    // The header surfaces exactly one of the three location/brand states:
    //   1. Authed + location set → <BrandStatusBar> ("Our Premium")
    //   2. Authed + no location → MapPin "Set Location" button
    //   3. Unauth → AnimatedBrandName sparkle (no Set Location, no Our Premium)
    // On a fresh Playwright browser there is no auth → unauth path. But we
    // assert the contract holds for any state: at most one of the three
    // surfaces is visible.
    const locationSurfaces = page.getByText(/Set Location|Select your location|Our Premium/);
    const visibleCount = await locationSurfaces
      .filter({ visible: true } as { visible: boolean })
      .count()
      .catch(async () => {
        // Older Playwright filter fallback — count all, then intersect with
        // visibility manually. Q1-clean: use the explicit graceful-skip
        // `.catch(() => false)` form so a detached/absent node counts as
        // not-visible rather than throwing.
        const all = await locationSurfaces.all();
        let visible = 0;
        for (const locator of all) {
          const isLocatorVisible = await locator.isVisible().catch(() => false);
          if (isLocatorVisible) {
            visible += 1;
          }
        }
        return visible;
      });

    expect(visibleCount).toBeLessThanOrEqual(1);
  });

  test('(e) featured tile background uses Blush Premium `bg-brand-pink-50`', async ({ page }) => {
    // Featured tile is the first category-card in document order (col-span-2,
    // hero slot in the 3+4+4+2 layout).
    const featured = page.locator('[data-testid="category-card"]').first();
    await expect(featured).toBeVisible();
    const className = (await featured.getAttribute('class')) ?? '';
    expect(className).toContain('bg-brand-pink-50');
  });
});
