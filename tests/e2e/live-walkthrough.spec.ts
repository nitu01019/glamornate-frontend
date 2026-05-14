/**
 * Automated signup → cart → booking walkthrough.
 *
 * Skipped by default. Run only when explicitly requested:
 *   WALKTHROUGH=1 pnpm exec playwright test tests/e2e/live-walkthrough.spec.ts \
 *     --project=chromium --headed --workers=1 --timeout=600000
 *
 * Captures every console error, page error, failed network request, and
 * interesting Firebase / API call to:
 *   tests/report/walkthrough-observe.log
 */

import { test, expect, type Page, type Request, type Response } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.join(__dirname, '..', 'report');
const LOG_PATH = path.join(LOG_DIR, 'walkthrough-observe.log');

const TIMESTAMP = Date.now();
const TEST_NAME = `Test Tester ${TIMESTAMP}`;
const TEST_EMAIL = `glamornate.test+${TIMESTAMP}@gmail.com`;
const TEST_PASSWORD = 'TestPass123!';

test('signup -> add to cart -> booking', async ({ page, context }) => {
  test.skip(process.env.WALKTHROUGH !== '1', 'Manual walkthrough — set WALKTHROUGH=1 to run.');
  test.setTimeout(15 * 60_000);

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const stream = fs.createWriteStream(LOG_PATH, { flags: 'w' });

  const ts = (): string => new Date().toISOString().slice(11, 23);
  const log = (line: string): void => {
    stream.write(`${ts()} ${line}\n`);
    // eslint-disable-next-line no-console
    console.log(line);
  };

  log('=== walkthrough started ===');
  log(`name=${TEST_NAME}  email=${TEST_EMAIL}  password=${TEST_PASSWORD}`);

  attachObservers(page, log);

  // ---- Register ----
  log('STEP 1: navigate to /auth/register');
  await page.goto('/auth/register');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});

  log('STEP 2: fill registration form');
  await page.locator('#name').fill(TEST_NAME);
  await page.locator('#email').fill(TEST_EMAIL);
  await page.waitForTimeout(700); // give availability pill a chance to fire
  const availPill = page.locator('#email-availability');
  const availText = (await availPill.innerText().catch(() => '')) ?? '';
  log(`  email availability pill: "${availText.trim().slice(0, 80)}"`);

  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#confirmPassword').fill(TEST_PASSWORD);
  await page.waitForTimeout(400);

  await page.screenshot({ path: 'tests/report/walkthrough-1-register-filled.png' });

  log('STEP 3: submit signup');
  await page.getByRole('button', { name: /^Create Account$/i }).click();

  // Wait for either success (redirect to dashboard) or error banner.
  log('  waiting for signup result…');
  const signupOutcome = await Promise.race([
    page
      .waitForURL(/\/(customer|spa|admin)\/(dashboard|profile)/, { timeout: 25_000 })
      .then(() => 'redirected' as const)
      .catch(() => 'no-redirect' as const),
    page
      .getByText(/Account Created!/i)
      .first()
      .waitFor({ timeout: 25_000 })
      .then(() => 'success-screen' as const)
      .catch(() => 'no-success' as const),
    page
      .locator('div.bg-red-50')
      .first()
      .waitFor({ timeout: 25_000 })
      .then(() => 'error-banner' as const)
      .catch(() => 'no-error' as const),
  ]);
  log(`  signup outcome: ${signupOutcome}`);

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/report/walkthrough-2-after-signup.png' });

  if (signupOutcome === 'error-banner') {
    const bannerText =
      (await page
        .locator('div.bg-red-50')
        .first()
        .innerText()
        .catch(() => '')) ?? '';
    log(`  ✗ signup error: "${bannerText.trim().slice(0, 200)}"`);
  } else {
    log(`  current url: ${page.url()}`);
  }

  // ---- Add to cart ----
  log('STEP 4: navigate to /services');
  await page.goto('/services');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});

  const categoryLinks = page.locator('a[href^="/services/category/"]');
  const categoryCount = await categoryLinks.count();
  log(`  categories: ${categoryCount}`);

  const categoryHrefs: string[] = [];
  for (let i = 0; i < categoryCount; i += 1) {
    const h = await categoryLinks.nth(i).getAttribute('href');
    if (h) categoryHrefs.push(h);
  }

  let chosenCat: string | null = null;
  let added = false;
  for (const cat of categoryHrefs) {
    log(`  try category ${cat}`);
    await page.goto(cat);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);

    const addBtn = await findAddButton(page);
    if (!addBtn) {
      log('    (no Add button — skip)');
      continue;
    }
    const addText = (await addBtn.textContent().catch(() => '')) ?? '';
    log(`    found Add button: "${addText.trim().slice(0, 30)}"`);
    await addBtn.scrollIntoViewIfNeeded().catch(() => {});
    await addBtn.click();
    await page.waitForTimeout(2000);
    chosenCat = cat;
    added = true;
    break;
  }
  if (!added) log('  ✗ no category had a service to add');
  await page.screenshot({ path: 'tests/report/walkthrough-3-after-add.png' });

  // ---- Booking ----
  // Phase 1 Task 1.1 (2026-05-08, spec-fe-2): legacy /booking wizard
  // deleted (SC-11). The walkthrough now drives the canonical wizard at
  // /customer/book-new. The conditional below remains a simple URL guard
  // because ProtectedRoute may redirect un-authed sessions away.
  log('STEP 5: navigate to /customer/book-new');
  await page.goto('/customer/book-new');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);

  const bookingUrl = page.url();
  log(`  booking url: ${bookingUrl}`);

  if (bookingUrl.includes('/customer/book-new')) {
    const stepText = await page
      .getByText(/Step \d+ of \d+/)
      .first()
      .textContent()
      .catch(() => null);
    log(`  step indicator: ${stepText ?? '(not visible)'}`);

    // Look for any visible error / toast.
    const errorText = await page
      .locator('[role="alert"], div.bg-red-50, div.bg-red-100')
      .first()
      .textContent()
      .catch(() => null);
    if (errorText) {
      log(`  ✗ error visible on booking page: "${errorText.trim().slice(0, 200)}"`);
    } else {
      log('  no error banner on booking page — looks healthy');
    }
  } else {
    log('  ✗ redirected away from /customer/book-new (auth gate or cart empty)');
  }

  await page.screenshot({ path: 'tests/report/walkthrough-4-booking.png', fullPage: true });

  // ---- Hold so user can see + interact ----
  log('STEP 6: holding browser open for 2 minutes so you can inspect.');
  await page.waitForTimeout(120_000).catch(() => {});

  log('=== walkthrough done ===');
  stream.end();
});

// ---------------------------------------------------------------------------

function attachObservers(page: Page, log: (s: string) => void): void {
  page.on('console', (msg) => {
    const type = msg.type().toUpperCase();
    if (type === 'ERROR' || type === 'WARNING') {
      log(`[CONSOLE ${type}] ${msg.text().slice(0, 500)}`);
    }
  });

  page.on('pageerror', (err) => {
    log(`[PAGEERROR] ${err.message.slice(0, 500)}`);
  });

  const isInteresting = (url: string): boolean =>
    url.includes('/api/v1/') ||
    url.includes('cloudfunctions.net') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebaseappcheck.googleapis.com') ||
    url.includes('checkSignupAvailability') ||
    url.includes('createBookingDraft') ||
    url.includes('confirmBooking');

  page.on('requestfinished', async (request: Request) => {
    const url = request.url();
    const response = await request.response().catch(() => null);
    const status = response?.status() ?? 0;
    const interesting = isInteresting(url);
    if (interesting || status >= 400) {
      const tag = status >= 400 ? '[NET FAIL]' : '[NET]';
      log(`${tag} ${request.method()} ${status} ${url.slice(0, 200)}`);
      if (status >= 400) {
        const body = await safeBody(response);
        if (body) log(`  body: ${body.slice(0, 400)}`);
      }
    }
  });

  page.on('requestfailed', (request: Request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    log(`[NET ABORT] ${request.method()} ${failure} ${request.url().slice(0, 200)}`);
  });
}

async function findAddButton(page: Page) {
  const candidates = [
    page.getByRole('button', { name: /^Add\b/i }).first(),
    page.getByRole('button', { name: /Add\s*\+/i }).first(),
    page.locator('button:has-text("Add +")').first(),
    page.locator('button:has-text("Add to cart")').first(),
  ];
  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
}

async function safeBody(response: Response | null): Promise<string | null> {
  if (!response) return null;
  try {
    const text = await response.text();
    return text.replace(/\s+/g, ' ').slice(0, 1000);
  } catch {
    return null;
  }
}
