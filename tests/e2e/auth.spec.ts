import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('login page renders with email and password fields', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    // Heading
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText('Sign in to continue your wellness journey')).toBeVisible();

    // Email field
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('placeholder', 'you@example.com');

    // Password field
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Submit button
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('register page renders with name, email, and password fields', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('domcontentloaded');

    // Heading
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await expect(page.getByText('Join us for exclusive wellness experiences')).toBeVisible();

    // Name field
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveAttribute('type', 'text');

    // Email field
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Password field
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();

    // Confirm password field
    const confirmPasswordInput = page.locator('#confirmPassword');
    await expect(confirmPasswordInput).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('login page has Google sign-in button', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    // "or continue with" divider
    await expect(page.getByText('or continue with')).toBeVisible();

    // Google button -- contains text "Google"
    const googleButton = page.getByRole('button', { name: /Google/ });
    await expect(googleButton).toBeVisible();
  });

  test('login form fields accept input', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    await passwordInput.fill('mypassword123');
    await expect(passwordInput).toHaveValue('mypassword123');
  });

  test('login form has required attribute on email and password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // Both fields should be required (HTML5 validation)
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('navigation between login and register works', async ({ page }) => {
    // Start at login
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    // Click "Sign up" link to go to register
    await page.getByRole('link', { name: 'Sign up' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/auth\/register/);
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

    // Click "Sign in" link to go back to login
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('login page has forgot password link', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    const forgotLink = page.getByRole('link', { name: 'Forgot password?' });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', '/auth/forgot-password');
  });

  test('register page password visibility toggle works', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('domcontentloaded');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the show/hide password toggle button
    const toggleButton = page.getByRole('button').filter({ has: page.locator('svg') }).nth(0);

    // Find the toggle that's adjacent to the password field
    const passwordWrapper = passwordInput.locator('..');
    const eyeToggle = passwordWrapper.getByRole('button');
    await eyeToggle.click();

    // After toggle, password should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('account page shows login prompt when not authenticated', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Guest header should show
    await expect(page.getByText('Your Profile')).toBeVisible();
    await expect(
      page.getByText('Log in or sign up to view your complete profile')
    ).toBeVisible();

    // Login/Signup button should link to auth
    const loginButton = page.getByRole('link', { name: 'Login / Signup' });
    await expect(loginButton).toBeVisible();
  });
});
