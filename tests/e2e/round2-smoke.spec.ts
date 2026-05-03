import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Round 2 P5 smoke suite - captures screenshots + pass/fail for each route
// at mobile viewport 390x844. Results are consumed by the investigation memo.
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/plans/investigations/round2/p5-smoke');

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: 'serial' });

async function settle(page: Page, extraMs = 3_500): Promise<void> {
  // Next dev compiles pages lazily; wait for network idle + hydration time
  // so Tailwind CSS + CSR content is fully applied before screenshot.
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(extraMs);
}

test('S1 home renders promo strip + Most Booked + 3+4 tiles', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settle(page, 5_000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 's1-home.png'),
    fullPage: true,
  });
  await expect(page.locator('#main-content')).toBeVisible();
});

test('S2 payments empty state + disabled banner', async ({ page }) => {
  await page.goto('/customer/payments', { waitUntil: 'domcontentloaded' });
  await settle(page, 5_000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 's2-payments.png'),
    fullPage: true,
  });
});

test('S3 blog index renders cards', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'domcontentloaded' });
  await settle(page, 4_000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 's3-blog-index.png'),
    fullPage: true,
  });
});

test('S4 blog detail: korean-glass-skin-facials', async ({ page }) => {
  await page.goto('/blog/korean-glass-skin-facials', {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 4_000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 's4-blog-korean.png'),
    fullPage: true,
  });
});

test('S5 blog detail: hydraglo-facials-explained', async ({ page }) => {
  await page.goto('/blog/hydraglo-facials-explained', {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 4_000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 's5-blog-hydraglo.png'),
    fullPage: true,
  });
});

test('S6 help page + journal CTA', async ({ page }) => {
  await page.goto('/help', { waitUntil: 'domcontentloaded' });
  await settle(page, 4_000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 's6-help.png'),
    fullPage: true,
  });
});

test('S7 profile → payment methods routing', async ({ page }) => {
  // Profile is ProtectedRoute-gated. In a logged-out browser the auth-provider
  // takes up to 5s to resolve isLoading=false; then ProtectedRoute replaces to
  // /auth/login?callbackUrl=/customer/profile. Alternatively the page sits on
  // /customer/profile with null content (no content rendered, no body).
  await page.goto('/customer/profile', { waitUntil: 'domcontentloaded' });
  await settle(page, 7_000);
  const profileLanding = page.url();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 's7a-profile-landing.png'),
    fullPage: true,
  });

  // Direct hit /customer/payments (the Payment Methods menu link target).
  // The routing contract: this URL must NOT redirect to home.
  await page.goto('/customer/payments', { waitUntil: 'domcontentloaded' });
  await settle(page, 7_000);
  const finalUrl = page.url();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 's7b-after-tap.png'),
    fullPage: true,
  });

  const onPayments = finalUrl.includes('/customer/payments');
  const onLogin = finalUrl.includes('/auth/login');
  const onHome = new URL(finalUrl).pathname === '/';

  // eslint-disable-next-line no-console
  console.log(`S7 evidence: profile landed at ${profileLanding}, final at ${finalUrl}`);

  expect(onPayments || onLogin, `final URL was ${finalUrl}`).toBe(true);
  expect(onHome, `landed on home instead of payments/login: ${finalUrl}`).toBe(false);
});
