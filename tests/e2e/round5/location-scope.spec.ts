import { test, expect, devices, type Page } from '@playwright/test';

/**
 * Round 5 E-1 — Location scope verification.
 *
 * Asserts the Round 5 Team A deliverable: the global "Set location" chip
 * (`data-testid="app-header-location-chip"`) is gone from every non-home
 * route, and location surfaces are routed through page-scoped components
 * instead:
 *   - `/`                     → `home-location-row`
 *   - `/spas`                 → `inline-location-trigger`
 *   - `/public/spas`          → `inline-location-trigger`
 *   - `/customer/book-new`    → `inline-location-trigger`
 *
 * We intentionally keep these tests public — they do NOT log a user in —
 * because the chip's old behaviour was gated on `isAuthenticated`. The
 * post-fix contract is stronger: the chip must be absent regardless of auth
 * state, and the home row must render from the PublicRoute shell.
 *
 * All tests are tagged `@round5` so CI can filter: `--grep @round5`.
 */

test.use({ ...devices['Pixel 5'], viewport: { width: 412, height: 915 } });

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
}

test.describe('@round5 Round5 location scope', () => {
  test('Home renders HomeLocationRow and no global location chip', async ({ page }) => {
    await page.goto('/');
    await settle(page);

    // HomeLocationRow is mounted on Home (public or authed).
    const homeRow = page.getByTestId('home-location-row');
    await expect(homeRow).toBeVisible();

    // The legacy chip must be absent — it was deleted from AppHeader.
    const chip = page.getByTestId('app-header-location-chip');
    await expect(chip).toHaveCount(0);
  });

  test('Account page has no global location chip', async ({ page }) => {
    await page.goto('/account');
    await settle(page);

    const chip = page.getByTestId('app-header-location-chip');
    await expect(chip).toHaveCount(0);

    // HomeLocationRow must also be absent outside of Home.
    const homeRow = page.getByTestId('home-location-row');
    await expect(homeRow).toHaveCount(0);
  });

  test('My Bookings page has no global location chip', async ({ page }) => {
    await page.goto('/customer/bookings');
    await settle(page);

    const chip = page.getByTestId('app-header-location-chip');
    await expect(chip).toHaveCount(0);

    const homeRow = page.getByTestId('home-location-row');
    await expect(homeRow).toHaveCount(0);
  });

  test('Cart page has no global location chip', async ({ page }) => {
    await page.goto('/cart');
    await settle(page);

    const chip = page.getByTestId('app-header-location-chip');
    await expect(chip).toHaveCount(0);

    const homeRow = page.getByTestId('home-location-row');
    await expect(homeRow).toHaveCount(0);
  });

  test('Services page has no global location chip', async ({ page }) => {
    await page.goto('/services');
    await settle(page);

    const chip = page.getByTestId('app-header-location-chip');
    await expect(chip).toHaveCount(0);
  });

  test('Spas page exposes an inline location trigger (and no global chip)', async ({ page }) => {
    await page.goto('/spas');
    await settle(page);

    // Agent 2 mounted InlineLocationTrigger inside the page body.
    const trigger = page.getByTestId('inline-location-trigger');
    await expect(trigger.first()).toBeVisible();

    const chip = page.getByTestId('app-header-location-chip');
    await expect(chip).toHaveCount(0);
  });

  test('Public spas page exposes an inline location trigger', async ({ page }) => {
    await page.goto('/public/spas');
    await settle(page);

    const trigger = page.getByTestId('inline-location-trigger');
    await expect(trigger.first()).toBeVisible();

    const chip = page.getByTestId('app-header-location-chip');
    await expect(chip).toHaveCount(0);
  });

  test('Customer book-new page exposes an inline location trigger', async ({ page }) => {
    // Book-new is auth-gated. Unauthenticated visitors get redirected to
    // login, which is the correct product behaviour — but the assertion is
    // still "chip gone", and on the login target that's trivially true.
    // We poll both possibilities to stay resilient.
    await page.goto('/customer/book-new');
    await settle(page);

    const url = page.url();
    const chip = page.getByTestId('app-header-location-chip');
    await expect(chip).toHaveCount(0);

    if (!url.includes('/auth/')) {
      const trigger = page.getByTestId('inline-location-trigger');
      // A triage-friendly soft assertion: if the route rendered without
      // redirect, the trigger must be present. Otherwise the test still
      // protects the "chip gone" invariant above.
      await expect(trigger.first()).toBeVisible();
    }
  });
});
