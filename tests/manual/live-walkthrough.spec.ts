/**
 * Live walkthrough — one test, one browser, stays open the whole time.
 *
 * Walks: Home -> Services -> first category -> Add to cart -> /booking ->
 * /auth/login -> Google sign-in (you complete OAuth in the open window).
 *
 * Run:
 *   pnpm exec playwright test tests/manual/live-walkthrough.spec.ts \
 *     --project=chromium --headed --workers=1 --timeout=600000
 *
 * Requires the dev server already running on http://localhost:3000.
 */

import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('live walkthrough: services -> add to cart -> booking -> google login', async ({
  page,
  context,
}) => {
  test.setTimeout(600_000);

  const log = (msg: string): void => {
    // eslint-disable-next-line no-console
    console.log(`▶ ${msg}`);
  };

  page.on('pageerror', (err) => log(`page error: ${err.message.slice(0, 200)}`));

  // Step 1 — Home
  log('Open home');
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);

  // Step 2 — Services list
  log('Navigate to /services');
  await page.goto('/services');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});

  // Step 3 — Pick first category
  log('Find category cards');
  const categoryLinks = page.locator('a[href^="/services/category/"]');
  const categoryCount = await categoryLinks.count();
  log(`  found ${categoryCount} category links`);
  expect(categoryCount).toBeGreaterThan(0);

  const firstCategory = categoryLinks.first();
  const href = await firstCategory.getAttribute('href');
  log(`  clicking: ${href ?? '(no href)'}`);
  await firstCategory.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});

  // Step 4 — Add first service to cart
  log('Look for Add button on category page');
  const addCandidates = [
    page.getByRole('button', { name: /^Add\b/i }).first(),
    page.getByRole('button', { name: /Add\s*\+/i }).first(),
    page.locator('button:has-text("Add +")').first(),
    page.locator('button:has-text("Add")').first(),
  ];

  let addedToCart = false;
  for (const candidate of addCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      const txt = (await candidate.textContent().catch(() => '')) ?? '';
      log(`  clicking Add button (text: "${txt.trim().slice(0, 30)}")`);
      await candidate.click();
      addedToCart = true;
      break;
    }
  }
  if (!addedToCart) log('  WARN: no Add button visible (catalog empty?)');

  await page.waitForTimeout(1500);

  // Step 5 — Booking
  log('Navigate to /booking');
  await page.goto('/booking');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const bookingUrl = page.url();
  log(`  landed on: ${bookingUrl}`);
  if (bookingUrl.includes('/booking')) {
    const stepText = await page
      .getByText(/Step \d+ of \d+/)
      .first()
      .textContent()
      .catch(() => null);
    log(`  step indicator: ${stepText ?? '(not visible)'}`);
    await tryClickFirstStepCTA(page, log);
  } else {
    log('  redirected away from /booking (likely empty cart)');
  }

  // Step 6 — Auth login
  log('Open /auth/login');
  await page.goto('/auth/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);

  // Step 7 — Click Google sign-in (Firebase opens a popup)
  log('Click Google sign-in');
  const googleBtn = page.getByRole('button', { name: /Google/i }).first();
  if (await googleBtn.isVisible().catch(() => false)) {
    const popupPromise = context.waitForEvent('page', { timeout: 10_000 }).catch(() => null);
    await googleBtn.click();
    const popup = await popupPromise;
    if (popup) {
      log(`  Google popup opened: ${popup.url().slice(0, 100)}`);
      log('  >>> Complete the OAuth in the popup window — browser stays open. <<<');
      // Wait for the popup to close (user finished or aborted) or timeout.
      await popup.waitForEvent('close', { timeout: 240_000 }).catch(() => {
        log('  (popup still open after 4 min wait)');
      });
    } else {
      log('  No popup detected (could be redirect-based or blocked).');
    }
  } else {
    log('  Google button not visible.');
  }

  // Step 8 — Hold open for free-form clicking
  log('Holding browser open 3 minutes for manual clicking. Ctrl+C to end.');
  await page.waitForTimeout(180_000);
});

async function tryClickFirstStepCTA(page: Page, log: (msg: string) => void): Promise<void> {
  // The booking step 1 (Location) usually has a "Continue" or address picker.
  const continueCandidates = [
    page.getByRole('button', { name: /Continue/i }).first(),
    page.getByRole('button', { name: /Next/i }).first(),
    page.getByRole('button', { name: /Choose location/i }).first(),
  ];
  for (const candidate of continueCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      const txt = (await candidate.textContent().catch(() => '')) ?? '';
      log(`  clicking step CTA: "${txt.trim().slice(0, 30)}"`);
      await candidate.click().catch(() => log('   click failed'));
      await page.waitForTimeout(1500);
      return;
    }
  }
  log('  no obvious step CTA visible (location may need manual selection)');
}
