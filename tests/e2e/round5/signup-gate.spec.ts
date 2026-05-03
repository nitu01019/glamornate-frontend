import { test, expect, devices, type Page } from '@playwright/test';

/**
 * Round 5 E-1 — Signup-gate verification.
 *
 * Asserts the Round 5 Team C-3 deliverable: `NEXT_PUBLIC_SIGNUP_ENABLED`
 * gates the `/auth/register` page. When the flag is `false` (or unset), the
 * `SignupDisabledView` component renders — identified by
 * `data-testid="signup-disabled"` — and no registration form inputs are
 * present. When the flag is `true`, the happy-path form renders.
 *
 * Important: `NEXT_PUBLIC_*` env vars are INLINED at build time by Next.js.
 * That means we cannot flip the flag between tests at runtime — the test
 * environment's build determines which view renders. These tests therefore
 * branch on the observed DOM:
 *
 *   - If `#email` input exists → we treat it as the "enabled" happy path and
 *     assert the form fields + submit CTA.
 *   - Else, we assert the disabled view + its copy + its login/back links.
 *
 * Both branches ARE exercised in CI by running the suite twice with
 * different `.env` values. When ran locally you'll see exactly one of the
 * two paths pass per run.
 *
 * This conditional shape is intentional — the plan asks for both cases to
 * be covered with a single spec file and `test.skip` would hide the
 * unused path. Branching keeps the spec honest for both builds.
 */

test.use({ ...devices['Pixel 5'], viewport: { width: 412, height: 915 } });

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
}

async function isSignupEnabled(page: Page): Promise<boolean> {
  // The enabled form uses the `#name` input; the disabled view never does.
  const marker = page.locator('#name');
  return marker
    .first()
    .isVisible({ timeout: 1_500 })
    .catch(() => false);
}

test.describe('@round5 Round5 signup gate', () => {
  test('register route renders either the form or the disabled view — never both', async ({
    page,
  }) => {
    await page.goto('/auth/register');
    await settle(page);

    const enabled = await isSignupEnabled(page);

    if (enabled) {
      // Happy path: `NEXT_PUBLIC_SIGNUP_ENABLED=true` in this build.
      await expect(page.getByRole('heading', { name: /Create account/i })).toBeVisible();
      await expect(page.locator('#name')).toBeVisible();
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#confirmPassword')).toBeVisible();
      await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();

      // The disabled view must NOT be present in the happy path.
      await expect(page.getByTestId('signup-disabled')).toHaveCount(0);
    } else {
      // Gated path: `NEXT_PUBLIC_SIGNUP_ENABLED` is unset or false.
      const disabledView = page.getByTestId('signup-disabled');
      await expect(disabledView).toBeVisible();

      // Copy is contractual — if anyone rewords the lock message, this
      // test protects the user-facing promise.
      await expect(disabledView).toContainText(/Signups temporarily disabled/i);

      // Existing users can still sign in — deep-link must be a real route.
      const loginLink = disabledView.getByRole('link', { name: /Log in/i });
      await expect(loginLink).toBeVisible();
      await expect(loginLink).toHaveAttribute('href', /\/auth\/login/);

      // Back to home escape hatch.
      const homeLink = disabledView.getByRole('link', { name: /Back to home/i });
      await expect(homeLink).toBeVisible();
      await expect(homeLink).toHaveAttribute('href', '/');

      // Form fields MUST NOT be present when the gate is closed.
      await expect(page.locator('#name')).toHaveCount(0);
      await expect(page.locator('#email')).toHaveCount(0);
      await expect(page.locator('#password')).toHaveCount(0);
    }
  });

  test('login page is always reachable regardless of signup flag', async ({ page }) => {
    // The login page is NOT gated — a user with an existing account must
    // always be able to sign in even when new signups are paused.
    await page.goto('/auth/login');
    await settle(page);

    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Sign In$/ })).toBeVisible();
  });

  test('disabled view deep-link from /auth/register → /auth/login works when gated', async ({
    page,
  }) => {
    await page.goto('/auth/register');
    await settle(page);

    const enabled = await isSignupEnabled(page);
    test.skip(
      enabled,
      'Signup is enabled in this build — the disabled view deep-link is not shown.',
    );

    const disabledView = page.getByTestId('signup-disabled');
    await expect(disabledView).toBeVisible();

    await disabledView.getByRole('link', { name: /Log in/i }).click();
    await settle(page);

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  });
});
