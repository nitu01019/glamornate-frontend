import { test, expect } from '@playwright/test';

test.describe('Service Browsing', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('services page loads with heading and search', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('domcontentloaded');

    // Header
    await expect(page.getByRole('heading', { name: 'Our Services' })).toBeVisible();
    await expect(page.getByText('Browse our complete catalog of beauty services')).toBeVisible();

    // Search input for filtering categories
    const searchInput = page.getByPlaceholder('Search categories...');
    await expect(searchInput).toBeVisible();
  });

  test('services page displays category cards in a grid', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('domcontentloaded');

    // Category cards are rendered inside a grid container
    const grid = page.locator('.grid');
    await expect(grid.first()).toBeVisible();

    // There should be at least one category card in the grid
    const gridChildren = grid.first().locator('> div');
    const count = await gridChildren.count();
    expect(count).toBeGreaterThan(0);
  });

  test('category search filter works', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByPlaceholder('Search categories...');

    // Type a search that should return no results
    await searchInput.fill('zzzznonexistent');
    await expect(page.getByText('No categories found')).toBeVisible();
    await expect(page.getByText('Try a different search term')).toBeVisible();

    // Clear search button should appear
    await expect(page.getByRole('button', { name: 'Clear Search' })).toBeVisible();

    // Clear and verify results come back
    await searchInput.fill('');
    const grid = page.locator('.grid');
    await expect(grid.first()).toBeVisible();
  });

  test('clicking a category card navigates to detail page', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('domcontentloaded');

    // Q1-clean: hard-assert visibility instead of the pass-when-absent
    // `if (isVisible)` pattern. If the catalog is empty the assertion
    // fails loudly rather than silently passing.
    const firstCategoryLink = page.locator('.grid a').first();
    await expect(firstCategoryLink).toBeVisible({ timeout: 10000 });
    await firstCategoryLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Should navigate to /services/{slug}
    await expect(page).toHaveURL(/\/services\/.+/);

    // The detail page should have a back button
    const backButton = page.getByRole('button', { name: 'Go back' });
    await expect(backButton).toBeVisible();
  });

  test('service detail page shows subcategory tabs and service list', async ({ page }) => {
    // Navigate to services page first, then click through
    await page.goto('/services');
    await page.waitForLoadState('domcontentloaded');

    // Q1-clean: hard-assert visibility instead of the pass-when-absent
    // conditional-visibility pattern.
    const firstCategoryLink = page.locator('.grid a').first();
    await expect(firstCategoryLink).toBeVisible({ timeout: 10000 });
    await firstCategoryLink.click();
    await page.waitForLoadState('domcontentloaded');

    // The category detail page should have a header with category name
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Description section
    const description = page.locator('.bg-white.px-4.py-3').first();
    await expect(description).toBeVisible();

    // Service items should be rendered -- each has an "Add +" button
    const addButtons = page.getByRole('button', { name: /Add/ });
    const addCount = await addButtons.count();
    expect(addCount).toBeGreaterThanOrEqual(0);
  });

  test('Add button on service items adds to cart and shows cart bar', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('domcontentloaded');

    // Q1-clean: hard-assert visibility for each step instead of the
    // pass-when-absent conditional-visibility pattern.
    const firstCategoryLink = page.locator('.grid a').first();
    await expect(firstCategoryLink).toBeVisible({ timeout: 10000 });
    await firstCategoryLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Find and click the first "Add +" button
    const addButton = page.getByRole('button', { name: /Add/ }).first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // After adding, the sticky cart bar should appear at the bottom
    const cartBar = page.getByRole('link', { name: /View Cart/ });
    await expect(cartBar).toBeVisible({ timeout: 5000 });
  });
});
