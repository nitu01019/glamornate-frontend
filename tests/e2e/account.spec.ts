import { test, expect } from '@playwright/test';

test.describe('Account Page', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('account page loads', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Page should render with main content area
    const main = page.locator('#main-content');
    await expect(main).toBeVisible();
  });

  test('shows login prompt when not authenticated', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Guest header -- "Your Profile" heading
    await expect(page.getByText('Your Profile')).toBeVisible();

    // Prompt message
    await expect(
      page.getByText('Log in or sign up to view your complete profile')
    ).toBeVisible();

    // Login / Signup button
    const loginLink = page.getByRole('link', { name: 'Login / Signup' });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute(
      'href',
      '/auth/login?callbackUrl=%2Faccount'
    );
  });

  test('menu items are visible for unauthenticated users', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // These menu items should always be visible (even when not logged in)
    await expect(page.getByText('Refer & Earn')).toBeVisible();
    await expect(page.getByText('Register as a Partner')).toBeVisible();
    await expect(page.getByText('Blog')).toBeVisible();
    await expect(page.getByText('Share the App')).toBeVisible();
    await expect(page.getByText('About Us')).toBeVisible();
    await expect(page.getByText('Privacy Policy')).toBeVisible();
    await expect(page.getByText('Terms & Conditions')).toBeVisible();
    await expect(page.getByText('Contact Us')).toBeVisible();
  });

  test('section headers are visible', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Earn With Us')).toBeVisible();
    await expect(page.getByText('Wanna Read Something?')).toBeVisible();
    await expect(page.getByText('Other Information')).toBeVisible();
  });

  test('app version footer is visible', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Scroll to bottom to see version footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(page.getByText('Glamornate').last()).toBeVisible();
    await expect(page.getByText('v1.0.0')).toBeVisible();
  });

  test('login link from account navigates to auth page', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    const loginLink = page.getByRole('link', { name: 'Login / Signup' });
    await loginLink.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('wallet section is NOT visible for unauthenticated users', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Wallet is only shown when isAuthenticated is true
    const walletRow = page.getByText('Glamour Wallet');
    await expect(walletRow).not.toBeVisible();
  });

  test('sign out button is NOT visible for unauthenticated users', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Sign Out row should only appear for authenticated users
    const signOutRow = page.getByText('Sign Out');
    await expect(signOutRow).not.toBeVisible();
  });
});
