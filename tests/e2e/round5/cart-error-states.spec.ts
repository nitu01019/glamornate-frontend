import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Round 5 C-4 + C-6 — `cart-error-states.spec.ts`
 *
 * Verifies the `CartErrorBanner` renders the correct variant + CTA for every
 * HTTP branch of the cart-preview request. The spec intercepts
 * `/api/v1/cart/preview` at the fetch layer (Playwright `page.route`) so we
 * do not depend on a live backend.
 *
 * Each test:
 *   1. Seeds a single item into the zustand cart via `localStorage`.
 *   2. Routes `**\/api/v1/cart/preview` to a fixture response.
 *   3. Loads `/cart`, taps "Proceed to Book", asserts the banner variant +
 *      the primary CTA.
 */

const CART_STORAGE_KEY = 'glamornate-cart';

type CartFixture = {
  state: {
    items: Array<{
      serviceId: string;
      quantity: number;
      name: string;
      price: number;
      image?: string;
      durationMinutes: number;
    }>;
    _hasHydrated: boolean;
    voucherCode: null;
    voucherDiscount: number;
    voucherName: null;
    voucherDiscountType: null;
    voucherDiscountValue: number;
    voucherMaxDiscount: null;
    voucherMinOrder: number;
  };
  version: number;
};

function cartFixture(): CartFixture {
  return {
    state: {
      items: [
        {
          serviceId: 'facial-classic',
          quantity: 1,
          name: 'Classic Facial',
          price: 999,
          durationMinutes: 60,
        },
      ],
      _hasHydrated: true,
      voucherCode: null,
      voucherDiscount: 0,
      voucherName: null,
      voucherDiscountType: null,
      voucherDiscountValue: 0,
      voucherMaxDiscount: null,
      voucherMinOrder: 0,
    },
    version: 1,
  };
}

async function seedCart(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: CART_STORAGE_KEY, value: JSON.stringify(cartFixture()) },
  );
}

async function mockPreview(page: Page, status: number, body: unknown): Promise<void> {
  await page.route('**/api/v1/cart/preview', async (route: Route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function tapProceed(page: Page): Promise<void> {
  const proceed = page.getByRole('button', { name: /Proceed to Book|Login to Book|Checking/ });
  await expect(proceed).toBeVisible({ timeout: 10_000 });
  await proceed.click();
}

test.describe('@round5 Cart error states (Round 5 C-4)', () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test.beforeEach(async ({ page }) => {
    await seedCart(page);
  });

  test('401 → auth-required banner with sign-in CTA pointing back to /cart', async ({ page }) => {
    await mockPreview(page, 401, {
      success: false,
      data: null,
      error: 'Unauthorized',
    });

    await page.goto('/cart');
    await tapProceed(page);

    const banner = page.getByTestId('cart-error-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-variant', 'auth-required');

    const signInCta = banner.getByRole('link', { name: /Sign in/i });
    await expect(signInCta).toHaveAttribute('href', /\/auth\/login\?next=%2Fcart/);
  });

  test('400 → items-unavailable banner with Refresh action', async ({ page }) => {
    await mockPreview(page, 400, {
      success: false,
      data: null,
      error: 'Items no longer available',
    });

    await page.goto('/cart');
    await tapProceed(page);

    const banner = page.getByTestId('cart-error-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-variant', 'items-unavailable');
    await expect(banner.getByTestId('cart-error-cta-refresh')).toBeVisible();
  });

  test('403 → address-required banner with deep-link to addresses', async ({ page }) => {
    await mockPreview(page, 403, {
      success: false,
      data: null,
      error: 'Address required',
    });

    await page.goto('/cart');
    await tapProceed(page);

    const banner = page.getByTestId('cart-error-banner');
    await expect(banner).toHaveAttribute('data-variant', 'address-required');
    await expect(banner.getByRole('link', { name: /Add address/i })).toHaveAttribute(
      'href',
      /\/customer\/addresses\?new=1/,
    );
  });

  test('429 → rate-limited banner with no CTA', async ({ page }) => {
    await mockPreview(page, 429, {
      success: false,
      data: null,
      error: 'Too many requests',
    });

    await page.goto('/cart');
    await tapProceed(page);

    const banner = page.getByTestId('cart-error-banner');
    await expect(banner).toHaveAttribute('data-variant', 'rate-limited');
    // No retry / refresh / sign-in CTAs on the rate-limit variant.
    await expect(banner.getByTestId('cart-error-cta-retry')).toHaveCount(0);
    await expect(banner.getByTestId('cart-error-cta-refresh')).toHaveCount(0);
  });

  test('500 → connection-issue banner with Retry', async ({ page }) => {
    await mockPreview(page, 500, {
      success: false,
      data: null,
      error: 'Internal',
    });

    await page.goto('/cart');
    await tapProceed(page);

    const banner = page.getByTestId('cart-error-banner');
    await expect(banner).toHaveAttribute('data-variant', 'connection-issue');
    await expect(banner.getByTestId('cart-error-cta-retry')).toBeVisible();
  });

  test('network error → connection-issue banner with Retry', async ({ page }) => {
    await page.route('**/api/v1/cart/preview', async (route: Route) => {
      await route.abort('failed');
    });

    await page.goto('/cart');
    await tapProceed(page);

    const banner = page.getByTestId('cart-error-banner');
    await expect(banner).toHaveAttribute('data-variant', 'connection-issue');
    await expect(banner.getByTestId('cart-error-cta-retry')).toBeVisible();
  });

  test('legacy /api/v1/cart/validate proxies to /preview with identical body', async ({
    request,
  }) => {
    // Sanity: both URLs answer the same POST identically.
    const payload = { items: [{ serviceId: 'facial-classic', quantity: 1 }] };

    const preview = await request.post('/api/v1/cart/preview', { data: payload });
    const validate = await request.post('/api/v1/cart/validate', { data: payload });

    expect(preview.status()).toBe(validate.status());
    const previewBody = (await preview.json()) as Record<string, unknown>;
    const validateBody = (await validate.json()) as Record<string, unknown>;
    expect(validateBody).toEqual(previewBody);

    // Proxy must NOT 308 — 308 is unreliable in Capacitor WebView for POST.
    expect(validate.status()).toBeLessThan(300);
  });
});
