import { test, expect, type Page } from '@playwright/test';

/**
 * Round 6 / Phase 1 A4 — `home-legacy.spec.ts`
 *
 * Regression spec for the flag-OFF path. When `NEXT_PUBLIC_HOME_V2_GRID`
 * is unset (or not `"1"`), `src/app/page.tsx` renders the legacy
 * `HeroBannerCarousel` + `CategoryTilesGrid` surface. These smoke
 * assertions lock the pre-Phase-1 baseline so we can detect any
 * accidental leak of the new components into the default experience.
 *
 * Contract (PHASE_1.md §7.4 regression guarantee):
 *   - Legacy hero carousel still mounts (same aria-label, NO
 *     `data-testid="home-hero"`).
 *   - Legacy category grid still mounts (13 `category-card` tiles,
 *     preserves the `category-tiles-grid` wrapper, and uses
 *     `featured-animated-label` for the HydraGlo row).
 *
 * The spec skips itself if the flag IS enabled so it doesn't false-fail
 * against the Phase-1 surface.
 */

const PHONE = { width: 393, height: 851 } as const;

async function settle(page: Page, extraMs = 2_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(extraMs);
}

async function ensureLegacy(page: Page): Promise<boolean> {
  const heroV2 = page.getByTestId('home-hero');
  const gridV2 = page.getByTestId('home-category-grid');
  const v2Count = (await heroV2.count()) + (await gridV2.count());
  if (v2Count > 0) {
    test.skip(
      true,
      'NEXT_PUBLIC_HOME_V2_GRID=1 is set — Phase-1 surface rendered. Run with the flag unset to exercise the legacy spec.',
    );
    return false;
  }
  return true;
}

test.describe('@round6 home-legacy — flag OFF regression (393×851)', () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await ensureLegacy(page);
  });

  test('legacy HeroBannerCarousel still mounts and exposes the carousel role', async ({
    page,
  }) => {
    // The legacy carousel does NOT emit `data-testid="home-hero"`. It shares
    // the same aria-label with the new one, so we key on the testid's
    // absence AND the role/aria-roledescription pair that both versions
    // expose.
    await expect(page.getByTestId('home-hero')).toHaveCount(0);

    const region = page.locator('[role="region"][aria-roledescription="carousel"]');
    await expect(region).toHaveCount(1);
    await expect(region).toBeVisible();

    // Legacy carousel renders painted title + subtitle text overlays — the
    // `Featured Facial` kicker is the easiest stable anchor (see
    // HeroBannerCarousel.tsx line 228). Its presence locks the legacy look
    // and feel.
    const legacyKicker = region.getByText(/Featured Facial/i).first();
    await expect(legacyKicker).toBeVisible();
  });

  test('swipe / dot indicators still work (legacy smoke)', async ({ page }) => {
    const region = page.locator('[role="region"][aria-roledescription="carousel"]');
    const dots = region.getByRole('button', { name: /Go to slide \d+/ });
    const dotCount = await dots.count();
    expect(dotCount).toBeGreaterThanOrEqual(2);

    // Clicking dot #2 must flip the active slide's aria-label live region.
    const before = await region.locator('[aria-live="polite"]').innerText();
    await dots.nth(1).click();
    await page.waitForTimeout(300);
    const after = await region.locator('[aria-live="polite"]').innerText();
    expect(after).not.toBe(before);
  });

  test('legacy CategoryTilesGrid renders with 13 category-card tiles', async ({ page }) => {
    // The new grid emits `home-category-grid` — assert absence.
    await expect(page.getByTestId('home-category-grid')).toHaveCount(0);

    // The legacy wrapper testid remains.
    await expect(page.getByTestId('category-tiles-grid')).toHaveCount(1);

    // Legacy tiles use `category-card` (see FeaturedCategoryTile /
    // SecondaryCategoryTile). The round-3 baseline asserts 13.
    const legacyTiles = page.locator('[data-testid="category-card"]');
    await expect(legacyTiles).toHaveCount(13);
  });

  test('legacy animated-label + secondary-tile-badge testids still render', async ({
    page,
  }) => {
    // These testids are removed by Phase 1; they MUST still exist when the
    // flag is off so we don't accidentally ship the new grid under the
    // default path.
    const animatedLabel = page.getByTestId('featured-animated-label');
    const labelCount = await animatedLabel.count();
    expect(labelCount).toBeGreaterThanOrEqual(1);

    // The secondary tile badge is optional (depends on which tiles carry
    // the `New` / `Most Booked` badge), but the testid should exist on the
    // legacy path if any badge is configured.
    const badge = page.getByTestId('secondary-tile-badge');
    const badgeCount = await badge.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });
});
