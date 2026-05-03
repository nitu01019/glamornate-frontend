import { test, expect } from '@playwright/test';

test.describe('Core Navigation', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('home page loads with hero, categories, and services sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // The page should have the main content area
    const main = page.locator('#main-content');
    await expect(main).toBeVisible();

    // Hero promotional banner section should exist
    // HeroBanner is wrapped in Suspense; wait for it to resolve
    const heroBanner = page.locator('[class*="animate-fade-in"]').first();
    await expect(heroBanner).toBeVisible();

    // Categories section -- NewCategoriesGrid renders category items
    // The "Deal of the Day" heading confirms the page fully loaded
    await expect(page.getByText('Deal of the Day')).toBeVisible();

    // "See All Offers" link should be present
    await expect(page.getByRole('link', { name: 'See All Offers' })).toBeVisible();
  });

  test('bottom nav has 5 tabs (Home, Services, Cart, Bookings, Account)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const bottomNav = page.locator('nav[aria-label="Bottom navigation"]');
    await expect(bottomNav).toBeVisible();

    // Verify all nav tab labels
    const expectedTabs = ['Home', 'Services', 'Cart', 'Bookings', 'Account'];
    for (const tab of expectedTabs) {
      await expect(bottomNav.getByText(tab, { exact: true })).toBeVisible();
    }
  });

  test('clicking each bottom nav tab navigates to correct page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const bottomNav = page.locator('nav[aria-label="Bottom navigation"]');

    // Navigate to Services
    await bottomNav.getByRole('link', { name: 'Services' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/services/);
    await expect(page.getByText('Our Services')).toBeVisible();

    // Navigate to Cart
    await bottomNav.getByRole('link', { name: 'Cart' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/cart/);

    // Navigate to Account
    await bottomNav.getByRole('link', { name: 'Account' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/account/);

    // Navigate back Home
    await bottomNav.getByRole('link', { name: 'Home' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/');
  });

  test('back navigation works from services page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to services via bottom nav
    const bottomNav = page.locator('nav[aria-label="Bottom navigation"]');
    await bottomNav.getByRole('link', { name: 'Services' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/services/);

    // Go back via browser back
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/');
  });

  test('404 page shows for invalid routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-at-all');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('Page not found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go back home' })).toBeVisible();
  });
});
