/**
 * auth.setup.ts — Q2 storageState fixture.
 *
 * Runs ONCE per Playwright invocation (as a `setup` project) and persists
 * the authenticated browser context to `tests/.auth/customer.json`. Projects
 * that declare `dependencies: ['setup']` + `use.storageState: ...` then
 * start each spec already signed in, eliminating the per-test UI login
 * cost for specs that don't specifically exercise the sign-in flow.
 *
 * This fixture intentionally uses the SAME UI login flow
 * (`signInUi`) that the Round 6 Phase 3 specs already exercise, so the
 * persisted session mirrors a real end-user session — same cookies, same
 * IndexedDB entries, same App Check token state.
 */

import { test as setup } from '@playwright/test';
import { seedDefaultCustomer } from './helpers/seed-user';

const AUTH_DIR = 'tests/.auth';
const CUSTOMER_STATE_PATH = `${AUTH_DIR}/customer.json`;

const LOGIN_URL = '/auth/login';
const POST_LOGIN_URL = '/customer/profile';

setup('authenticate customer', async ({ page }) => {
  const user = await seedDefaultCustomer('shared');

  await page.goto(`${LOGIN_URL}?callbackUrl=${encodeURIComponent(POST_LOGIN_URL)}`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: /^Sign In$/ }).click();
  await page.waitForURL(new RegExp(`${POST_LOGIN_URL}$`), { timeout: 15_000 });
  await page.waitForLoadState('domcontentloaded');

  await page.context().storageState({ path: CUSTOMER_STATE_PATH });
});
