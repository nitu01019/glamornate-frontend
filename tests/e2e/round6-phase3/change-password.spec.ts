/**
 * Round 6 Phase 3 — Change Password E2E spec.
 *
 * Covers PHASE_3.md §1 success criteria S1 and S2:
 *   - S1: Change Password flow completes end-to-end with a signed-in user.
 *   - S2: Every mapped Firebase Auth error code renders distinct user copy.
 *
 * The suite runs against the Firebase Auth emulator seeded by
 * `tests/helpers/seed-user.ts`. It does NOT mutate production, never
 * pins hard-coded UIDs, and every spec is independent so parallel
 * workers are safe.
 *
 * Real-selector contract (verified via grep on ChangePasswordSheet.tsx):
 *   - Sheet opened via the "Change Password" row in the profile page
 *     (`src/app/customer/profile/page.tsx`).
 *   - Title: "Change password" (h-level semantics from DialogPrimitive.Title)
 *   - Current password input: `#cps-current` (autoComplete=current-password)
 *   - New password input:     `#cps-new`     (autoComplete=new-password)
 *   - Confirm input:          `#cps-confirm` (autoComplete=new-password)
 *   - Submit button:          role=button, name=/Update password/
 *   - Field-level error:      `#cps-current-err` or `#cps-new-err`
 *   - Banner error:           role=alert inside the form
 *
 * NOTE FOR THE RUNNER:
 *   These specs compile and match the component's real selectors. They
 *   require the Auth emulator + Firestore emulator running (see the
 *   emulator test header for the one-liner) and a Next dev server that
 *   connects to them via the standard `FIREBASE_AUTH_EMULATOR_HOST` env
 *   var. Agent 3E's mandate was to author the specs, not execute them.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  seedDefaultCustomer,
  deleteTestUser,
  type SeedUserResult,
} from '../../helpers/seed-user';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const LOAD_STATE = 'domcontentloaded' as const;
const PROFILE_URL = '/customer/profile';
const LOGIN_URL = '/auth/login';

const STRONG_NEW_PASSWORD = 'FreshPass98$Gem';
const WEAK_PASSWORD = '1234';
const DIFFERENT_PASSWORD = 'AnotherPick55!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInUi(
  page: Page,
  user: Pick<SeedUserResult, 'email' | 'password'>,
): Promise<void> {
  await page.goto(`${LOGIN_URL}?callbackUrl=${encodeURIComponent(PROFILE_URL)}`);
  await page.waitForLoadState(LOAD_STATE);

  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: /^Sign In$/ }).click();

  // Auth provider redirects based on role after sign-in; we wait for the
  // profile page specifically.
  await page.waitForURL(new RegExp(`${PROFILE_URL}$`), { timeout: 15_000 });
  await page.waitForLoadState(LOAD_STATE);
}

async function openChangePasswordSheet(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Change Password' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  // The bottom sheet carries a DialogPrimitive.Title "Change password".
  await expect(
    page.getByRole('dialog').getByText('Change password', { exact: true }),
  ).toBeVisible();
}

async function fillChangePasswordForm(
  page: Page,
  values: {
    readonly current: string;
    readonly next: string;
    readonly confirm: string;
  },
): Promise<void> {
  await page.locator('#cps-current').fill(values.current);
  await page.locator('#cps-new').fill(values.next);
  await page.locator('#cps-confirm').fill(values.confirm);
}

async function submitChangePasswordForm(page: Page): Promise<void> {
  const submit = page.getByRole('button', { name: /Update password/ });
  await expect(submit).toBeEnabled();
  await submit.click();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@round6-phase3 Change Password', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('happy path: signed-in user rotates password end-to-end (S1)', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('cp-happy');
    try {
      await signInUi(page, user);
      await openChangePasswordSheet(page);

      await fillChangePasswordForm(page, {
        current: user.password,
        next: STRONG_NEW_PASSWORD,
        confirm: STRONG_NEW_PASSWORD,
      });
      await submitChangePasswordForm(page);

      // On success the sheet closes and a toast announces the rotation.
      // The sheet's DialogPrimitive.Title should no longer be visible.
      await expect(
        page.getByRole('dialog').getByText('Change password', { exact: true }),
      ).toBeHidden({ timeout: 10_000 });

      // Best-effort check on success toast copy from the component
      await expect(page.getByText(/Password updated/i)).toBeVisible({
        timeout: 5_000,
      });

      // Verify the new password actually works end-to-end by signing out
      // via the hardened signOut flow and re-authenticating.
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await page.waitForURL(/\/$/, { timeout: 10_000 });

      await signInUi(page, { email: user.email, password: STRONG_NEW_PASSWORD });
      await expect(page).toHaveURL(new RegExp(`${PROFILE_URL}$`));
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('wrong current password surfaces the mapped field error (S2 — auth/wrong-password / auth/invalid-credential)', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('cp-wrong-current');
    try {
      await signInUi(page, user);
      await openChangePasswordSheet(page);

      await fillChangePasswordForm(page, {
        current: 'NotTheRealPassword!1',
        next: STRONG_NEW_PASSWORD,
        confirm: STRONG_NEW_PASSWORD,
      });
      await submitChangePasswordForm(page);

      // The field-level error is hung off `#cps-current-err` and uses the
      // mapped auth-error-map copy ("Incorrect current password" or
      // "Sign-in details could not be verified").
      const fieldError = page.locator('#cps-current-err');
      await expect(fieldError).toBeVisible({ timeout: 8_000 });
      await expect(fieldError).toHaveText(
        /Incorrect current password|Sign-in details could not be verified/i,
      );

      // The sheet must stay open so the user can retry.
      await expect(
        page.getByRole('dialog').getByText('Change password', { exact: true }),
      ).toBeVisible();

      // And the current-password input is re-focused + cleared for retry
      // per ChangePasswordSheet.tsx handleSubmit catch block.
      await expect(page.locator('#cps-current')).toHaveValue('');
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('weak new password is blocked client-side by the strength gate', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('cp-weak');
    try {
      await signInUi(page, user);
      await openChangePasswordSheet(page);

      await fillChangePasswordForm(page, {
        current: user.password,
        next: WEAK_PASSWORD,
        confirm: WEAK_PASSWORD,
      });

      // `canSubmit` in the component requires `strength.meetsMinimum`, so
      // the submit button must be disabled before we even reach Firebase.
      const submit = page.getByRole('button', { name: /Update password/ });
      await expect(submit).toBeDisabled();

      // Strength meter must announce "Too weak" or "Weak" via aria-live.
      await expect(
        page.getByText(/Too weak|Weak/).first(),
      ).toBeVisible();
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('new + confirm mismatch blocks submission', async ({ page }) => {
    const user = await seedDefaultCustomer('cp-mismatch');
    try {
      await signInUi(page, user);
      await openChangePasswordSheet(page);

      await fillChangePasswordForm(page, {
        current: user.password,
        next: STRONG_NEW_PASSWORD,
        confirm: DIFFERENT_PASSWORD,
      });

      const submit = page.getByRole('button', { name: /Update password/ });
      await expect(submit).toBeDisabled();

      // Inline hint from the component.
      await expect(page.getByText('Passwords do not match.')).toBeVisible();
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('requires-recent-login reprompts for the current password (S2)', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('cp-stale');
    try {
      await signInUi(page, user);
      await openChangePasswordSheet(page);

      // Simulate Firebase throwing `auth/requires-recent-login` on the
      // first submit. We intercept the Identity Toolkit endpoint the
      // Firebase SDK calls for re-auth / update-password in emulator
      // mode, and flip the response exactly once.
      let firstCall = true;
      await page.route(
        /identitytoolkit\.googleapis\.com\/.+(accounts:signInWithPassword|accounts:update)/,
        async (route) => {
          if (firstCall) {
            firstCall = false;
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({
                error: {
                  code: 400,
                  message: 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN',
                  status: 'INVALID_ARGUMENT',
                },
              }),
            });
            return;
          }
          await route.continue();
        },
      );

      await fillChangePasswordForm(page, {
        current: user.password,
        next: STRONG_NEW_PASSWORD,
        confirm: STRONG_NEW_PASSWORD,
      });
      await submitChangePasswordForm(page);

      // Mapped auth/requires-recent-login copy: "Please re-enter your password".
      const error = page.locator('#cps-current-err');
      await expect(error).toBeVisible({ timeout: 8_000 });
      await expect(error).toHaveText(/Please re-enter your password/i);

      // The sheet remains open and `#cps-current` is refocused + cleared.
      await expect(
        page.getByRole('dialog').getByText('Change password', { exact: true }),
      ).toBeVisible();
      await expect(page.locator('#cps-current')).toHaveValue('');

      // User retries with the same credential — route handler now passes
      // through and the real emulator accepts the change.
      await fillChangePasswordForm(page, {
        current: user.password,
        next: STRONG_NEW_PASSWORD,
        confirm: STRONG_NEW_PASSWORD,
      });
      await submitChangePasswordForm(page);

      await expect(
        page.getByRole('dialog').getByText('Change password', { exact: true }),
      ).toBeHidden({ timeout: 10_000 });
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });
});
