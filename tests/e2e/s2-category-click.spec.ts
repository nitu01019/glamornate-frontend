/**
 * Phase 2 regression guard for S2 — category card clickability on mobile home.
 *
 * Baseline (commit a023230) proved that a z-[70] promo popup backdrop
 * intercepts all pointer events on the Pixel 5 viewport once the 2-second
 * auto-open timer fires. Category cards (and every other home CTA) become
 * untappable until the user finds and taps the tiny close button.
 *
 * This spec fails if the overlay is ever allowed to intercept a tap on a
 * primary CTA: the category card must navigate to `/services/category/<slug>`.
 *
 * Usage:
 *   npx playwright test tests/e2e/s2-category-click.spec.ts \
 *     --project='Mobile Chrome' --reporter=list --timeout=60000
 */

import { test, expect } from '@playwright/test';

test.describe('S2 — category card clickability (mobile home)', () => {
  test('category cards are clickable on mobile home', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.getByTestId('category-card').first();
    await expect(firstCard).toBeVisible();

    // If a promo popup happens to be open, dismiss via the close button so the
    // test verifies the underlying navigation and not the popup behaviour.
    const closeBtn = page.getByRole('button', { name: /close promotional popup/i });
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }

    await firstCard.click({ timeout: 5000 });
    await expect(page).toHaveURL(/\/services\/category\//);
  });

  test('popup auto-open does not block category card clicks', async ({ page }) => {
    await page.goto('/');

    // Wait long enough for the 2-second auto-open timer in `popup` store to
    // fire and the backdrop to reach `opacity-100`.
    await page.waitForTimeout(2500);

    const firstCard = page.getByTestId('category-card').first();
    await expect(firstCard).toBeVisible();

    // Clicking the card while the popup is open must succeed: the backdrop
    // must not swallow pointer events on primary CTAs. Using the default
    // `click()` (strict) asserts that the element is the event target —
    // Playwright fails the call with a pointer-intercept error when the
    // backdrop is on top. We only assert the click succeeds, not the
    // destination (which is covered by the first test).
    await firstCard.click({ timeout: 5000 });
  });
});
