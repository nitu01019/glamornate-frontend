/**
 * Live walkthrough — opens ONE browser and stays open.
 *
 * Walks through:
 *   1. Home -> Services
 *   2. First category -> first service -> Add to cart
 *   3. /booking step 1 (Location)
 *   4. /auth/login -> click Google sign-in (user completes OAuth in the open
 *      window; the script waits)
 *
 * Run with:
 *   pnpm exec tsx tests/manual/live-walkthrough.ts
 *
 * Requires the dev server already running on http://localhost:3000.
 */

import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test';

const BASE = process.env.WALKTHROUGH_BASE ?? 'http://localhost:3000';
const SLOWMO = Number(process.env.WALKTHROUGH_SLOWMO ?? '650');
const HOLD_AT_END_MS = Number(process.env.WALKTHROUGH_HOLD_MS ?? '180000'); // 3 min

function step(label: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n▶ ${label}`);
}

function info(label: string): void {
  // eslint-disable-next-line no-console
  console.log(`   · ${label}`);
}

async function safeClick(page: Page, label: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    info(`clicked: ${label}`);
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message.split('\n')[0] : 'unknown error';
    info(`SKIP ${label} — ${msg}`);
    return false;
  }
}

async function main(): Promise<void> {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    step('Launching Chromium (headed, slowMo so you can watch)…');
    browser = await chromium.launch({ headless: false, slowMo: SLOWMO });
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      // Real-ish UA so Firebase / Google OAuth doesn't reject as bot.
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') info(`page console error: ${msg.text().slice(0, 200)}`);
    });
    page.on('pageerror', (err) => info(`page error: ${err.message.slice(0, 200)}`));

    // ----- Home -----
    step('Open home');
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.screenshot({ path: 'tests/report/walkthrough-01-home.png', fullPage: false });

    // ----- Services list -----
    step('Navigate to /services');
    await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.screenshot({ path: 'tests/report/walkthrough-02-services.png', fullPage: false });

    // ----- First category -----
    step('Click first category card');
    const categoryLinks = page.locator('a[href^="/services/category/"]');
    const categoryCount = await categoryLinks.count();
    info(`found ${categoryCount} category links`);
    if (categoryCount === 0) {
      info('no categories — skipping rest of cart flow');
    } else {
      const firstCategory = categoryLinks.first();
      const href = await firstCategory.getAttribute('href');
      info(`first category href: ${href ?? '(none)'}`);
      await firstCategory.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.screenshot({ path: 'tests/report/walkthrough-03-category.png', fullPage: false });

      // ----- Add to cart -----
      step('Find first "Add" button on category page');
      const addCandidates = [
        page.getByRole('button', { name: /^Add\b/i }),
        page.getByRole('button', { name: /Add to cart/i }),
        page.locator('button:has-text("Add +")'),
        page.locator('button:has-text("Add")'),
      ];
      let added = false;
      for (const candidate of addCandidates) {
        const c = candidate.first();
        if (await c.isVisible().catch(() => false)) {
          await safeClick(page, 'Add button', async () => {
            await c.click();
          });
          added = true;
          break;
        }
      }
      if (!added) info('no Add button found — service catalog may be empty');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'tests/report/walkthrough-04-after-add.png', fullPage: false });

      // ----- Booking page -----
      step('Navigate to /booking');
      await page.goto(`${BASE}/booking`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      const bookingUrl = page.url();
      info(`landed on: ${bookingUrl}`);
      await page.screenshot({ path: 'tests/report/walkthrough-05-booking.png', fullPage: true });

      if (bookingUrl.includes('/booking')) {
        const stepLabel = await page.getByText(/Step \d+ of \d+/).first().textContent().catch(() => null);
        info(`step indicator: ${stepLabel ?? '(not found)'}`);
      } else {
        info('redirected away from /booking — likely empty cart');
      }
    }

    // ----- Auth login + Google -----
    step('Open /auth/login');
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.screenshot({ path: 'tests/report/walkthrough-06-login.png', fullPage: false });

    step('Click Google sign-in');
    const googleBtn = page.getByRole('button', { name: /Google/i }).first();
    const googleVisible = await googleBtn.isVisible().catch(() => false);
    if (!googleVisible) {
      info('Google button not visible — skipping OAuth');
    } else {
      // Firebase signInWithPopup opens a window; wait up to 8s for it.
      const popupPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
      await googleBtn.click();
      const popup = await popupPromise;
      if (popup) {
        info(`Google OAuth popup opened: ${popup.url().slice(0, 120)}`);
        info('You can complete the login in that popup window — the main browser will stay open.');
      } else {
        info('No popup detected — might be redirect-based or blocked.');
      }
    }

    step(`Browser will STAY OPEN for ${Math.round(HOLD_AT_END_MS / 1000)}s — drive it yourself, finish the Google login, click around. Ctrl+C the script when done.`);
    await page.waitForTimeout(HOLD_AT_END_MS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`\n✖ Walkthrough error: ${msg}`);
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    step('Done — browser closed.');
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
