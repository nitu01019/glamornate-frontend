import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Round 6 / Phase 1 A4 — `home-grid-v2.spec.ts`
 *
 * Validates the Phase-1 13-tile Yes-Madam-style category grid
 * (`HomeCategoryGrid` + `CategoryTileWide` + `CategoryTileSquare`) when
 * `NEXT_PUBLIC_HOME_V2_GRID=1`.
 *
 * Contract under test (PHASE_1.md §1, §3.4, §7.3):
 *   - Exactly 13 `[data-testid="category-tile"]` elements render.
 *   - Exactly 2 of them carry `[data-wide="true"]`.
 *   - Wide tiles span the full grid width on phone (their bounding box
 *     width ≈ viewport width − section padding).
 *   - No tile contains any descendant text (name label is rendered
 *     OUTSIDE the tile as a `<figcaption>` sibling).
 *   - Category name label is visible beneath each tile.
 *   - Grid columns: 3 on phone, 4 on tablet-sm, 5 on desktop.
 *
 * The spec skips gracefully if the flag is not enabled so it doesn't
 * false-fail on a legacy-render dev boot.
 */

const PHONE = { width: 375, height: 812 } as const;
const TABLET_SM = { width: 768, height: 1024 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;

const EXPECTED_TILE_COUNT = 13;
const EXPECTED_WIDE_COUNT = 2;

/**
 * Section `px-4` → 16 px left and right padding. Wide tiles should span
 * the remaining (viewport − 32) pixels. We allow a tolerance of 8 px for
 * scrollbar / subpixel rounding differences across browsers.
 */
const SECTION_HORIZONTAL_PADDING_PX = 32;
const WIDTH_TOLERANCE_PX = 8;

async function settle(page: Page, extraMs = 2_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(extraMs);
}

async function ensureGridV2(page: Page): Promise<boolean> {
  const grid = page.getByTestId('home-category-grid');
  const count = await grid.count();
  if (count === 0) {
    test.skip(
      true,
      'NEXT_PUBLIC_HOME_V2_GRID=1 not set on dev server — legacy grid rendered. Re-run with the flag.',
    );
    return false;
  }
  return true;
}

async function expectedGridColumns(grid: Locator): Promise<number> {
  // The grid container is the first child of the section carrying the test
  // id; we read its computed `grid-template-columns` to count tracks.
  const template = await grid
    .locator('div.grid')
    .first()
    .evaluate((node) => window.getComputedStyle(node).gridTemplateColumns);
  return template.trim().length === 0 ? 0 : template.trim().split(/\s+/).length;
}

test.describe('@round6 home-grid-v2 — phone (375×812)', () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await ensureGridV2(page);
  });

  test('renders exactly 13 tiles and exactly 2 with data-wide="true"', async ({ page }) => {
    const tiles = page.locator('[data-testid="category-tile"]');
    await expect(tiles).toHaveCount(EXPECTED_TILE_COUNT);

    const wides = page.locator('[data-testid="category-tile"][data-wide="true"]');
    await expect(wides).toHaveCount(EXPECTED_WIDE_COUNT);
  });

  test('no descendant text inside any tile', async ({ page }) => {
    // Exact spec assertion from PHASE_1.md §1 item 6: zero matching text
    // nodes anywhere under any category tile.
    const textUnderTiles = page.locator('[data-testid="category-tile"] >> text=/\\S/');
    await expect(textUnderTiles).toHaveCount(0);

    // Belt-and-suspenders: no painted heading / paragraph / span text.
    const paintedText = page.locator(
      '[data-testid="category-tile"] h1, [data-testid="category-tile"] h2, [data-testid="category-tile"] h3, [data-testid="category-tile"] h4, [data-testid="category-tile"] h5, [data-testid="category-tile"] h6, [data-testid="category-tile"] p, [data-testid="category-tile"] span',
    );
    await expect(paintedText).toHaveCount(0);
  });

  test('wide tiles span the full width on phone (≈ viewport − 32 px)', async ({ page }) => {
    const wides = page.locator('[data-testid="category-tile"][data-wide="true"]');
    const count = await wides.count();
    expect(count).toBe(EXPECTED_WIDE_COUNT);

    const expectedWidth = PHONE.width - SECTION_HORIZONTAL_PADDING_PX;
    for (let i = 0; i < count; i += 1) {
      const tile = wides.nth(i);
      await tile.scrollIntoViewIfNeeded();
      const box = await tile.boundingBox();
      expect(box).not.toBeNull();
      if (box === null) continue;
      expect(Math.abs(box.width - expectedWidth)).toBeLessThanOrEqual(WIDTH_TOLERANCE_PX);
    }
  });

  test('each tile renders a visible name label BELOW it (figcaption sibling)', async ({
    page,
  }) => {
    const figures = page
      .getByTestId('home-category-grid')
      .locator('figure');
    const count = await figures.count();
    expect(count).toBe(EXPECTED_TILE_COUNT);

    for (let i = 0; i < count; i += 1) {
      const figure = figures.nth(i);
      const caption = figure.locator('figcaption');
      await expect(caption).toHaveCount(1);

      const tile = figure.locator('[data-testid="category-tile"]');
      const tileBox = await tile.boundingBox();
      const captionBox = await caption.boundingBox();
      expect(tileBox).not.toBeNull();
      expect(captionBox).not.toBeNull();
      if (tileBox === null || captionBox === null) continue;

      // Caption must render visually BELOW the tile (top of caption >=
      // bottom of tile image, allowing a 1 px subpixel slack).
      expect(captionBox.y + 1).toBeGreaterThanOrEqual(tileBox.y + tileBox.height - 1);
      const captionText = (await caption.innerText()).trim();
      expect(captionText.length).toBeGreaterThan(0);
    }
  });

  test('grid renders 3 columns on phone', async ({ page }) => {
    const grid = page.getByTestId('home-category-grid');
    await grid.scrollIntoViewIfNeeded();
    const columns = await expectedGridColumns(grid);
    expect(columns).toBe(3);
  });
});

test.describe('@round6 home-grid-v2 — tablet-sm (768×1024)', () => {
  test.use({ viewport: TABLET_SM });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await ensureGridV2(page);
  });

  test('renders exactly 13 tiles with 2 wide', async ({ page }) => {
    await expect(page.locator('[data-testid="category-tile"]')).toHaveCount(
      EXPECTED_TILE_COUNT,
    );
    await expect(
      page.locator('[data-testid="category-tile"][data-wide="true"]'),
    ).toHaveCount(EXPECTED_WIDE_COUNT);
  });

  test('no descendant text inside any tile', async ({ page }) => {
    const textUnderTiles = page.locator('[data-testid="category-tile"] >> text=/\\S/');
    await expect(textUnderTiles).toHaveCount(0);
  });

  test('grid renders 4 columns on tablet-sm', async ({ page }) => {
    const grid = page.getByTestId('home-category-grid');
    await grid.scrollIntoViewIfNeeded();
    const columns = await expectedGridColumns(grid);
    expect(columns).toBe(4);
  });
});

test.describe('@round6 home-grid-v2 — desktop (1280×800)', () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await ensureGridV2(page);
  });

  test('renders exactly 13 tiles with 2 wide', async ({ page }) => {
    await expect(page.locator('[data-testid="category-tile"]')).toHaveCount(
      EXPECTED_TILE_COUNT,
    );
    await expect(
      page.locator('[data-testid="category-tile"][data-wide="true"]'),
    ).toHaveCount(EXPECTED_WIDE_COUNT);
  });

  test('no descendant text inside any tile', async ({ page }) => {
    const textUnderTiles = page.locator('[data-testid="category-tile"] >> text=/\\S/');
    await expect(textUnderTiles).toHaveCount(0);
  });

  test('grid renders 5 columns on desktop', async ({ page }) => {
    const grid = page.getByTestId('home-category-grid');
    await grid.scrollIntoViewIfNeeded();
    const columns = await expectedGridColumns(grid);
    expect(columns).toBe(5);
  });

  test('no deprecated badge / animated-label testids in DOM', async ({ page }) => {
    // Phase-1 bans these ids from the new grid; if they leak in we want to
    // catch it at the viewport class that renders every tile.
    await expect(page.getByTestId('secondary-tile-badge')).toHaveCount(0);
    await expect(page.getByTestId('featured-animated-label')).toHaveCount(0);
  });
});
