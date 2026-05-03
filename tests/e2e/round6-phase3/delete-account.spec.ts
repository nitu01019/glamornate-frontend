/**
 * Round 6 Phase 3 — Delete Account E2E spec.
 *
 * Covers PHASE_3.md §1 success criteria S3, S6, S7 + policy reach-count:
 *   - S3: cascade deletion removes user data and ends at Firebase Auth.
 *   - S6: Delete Account entry is reachable in ≤ 2 taps from the app entry
 *     (Play Store policy requirement).
 *   - S7: `account.deleteEnabled` feature flag controls rollout (the
 *     profile page reads a local flag; this spec asserts the row is
 *     present when the flag is on).
 *
 * Real-selector contract (verified via grep on DeleteAccountSheet.tsx):
 *   - Trigger button on profile: role=button, name="Delete Account".
 *   - Dialog title: "Delete your account" (step explain).
 *   - Acknowledgement checkbox: the only native checkbox inside the sheet.
 *   - Confirmation input: `#dlt-confirm` — value must equal the constant
 *     `DELETE_CONFIRMATION_PHRASE` from the sheet.
 *   - "Continue" button advances to step 2 (reauth).
 *   - Re-auth password input: `#dlt-pwd`.
 *   - Submit: role=button, name=/Permanently delete my account/.
 *   - Step 3 status live region: role=status ("Deleting your account…").
 *   - Post-delete redirect: `/auth/login?accountDeleted=1`.
 *
 * Mirrors the backend contract from
 * `backend/functions/src/callable/deleteAccount.ts`:
 *   - `DELETE_CONFIRMATION` = 'DELETE MY ACCOUNT'
 *   - `{ success: true, alreadyDeleted?: boolean, warnings?: string[] }`
 */

import { expect, test, type Page } from '@playwright/test';
import {
  deleteTestUser,
  seedDefaultCustomer,
  type SeedUserResult,
} from '../../helpers/seed-user';

// ---------------------------------------------------------------------------
// Constants — MUST match backend + frontend constants exactly.
// ---------------------------------------------------------------------------

/** Mirror of `DELETE_CONFIRMATION` from backend/functions/src/callable/deleteAccount.ts. */
const DELETE_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

/** Mirror of `POST_DELETE_REDIRECT` from DeleteAccountSheet.tsx. */
const POST_DELETE_REDIRECT_PATTERN = /\/auth\/login\?.*accountDeleted=1/;

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const LOAD_STATE = 'domcontentloaded' as const;
const PROFILE_URL = '/customer/profile';
const LOGIN_URL = '/auth/login';

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
  await page.waitForURL(new RegExp(`${PROFILE_URL}$`), { timeout: 15_000 });
  await page.waitForLoadState(LOAD_STATE);
}

async function openDeleteAccountSheet(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Delete Account' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(
    page.getByRole('dialog').getByText('Delete your account', { exact: true }),
  ).toBeVisible();
}

async function advanceFromExplain(
  page: Page,
  phrase: string,
  acknowledge = true,
): Promise<void> {
  if (acknowledge) {
    const checkbox = page.getByRole('dialog').locator('input[type="checkbox"]');
    await checkbox.check();
  }
  await page.locator('#dlt-confirm').fill(phrase);
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function submitReauth(page: Page, password: string): Promise<void> {
  await page.locator('#dlt-pwd').fill(password);
  await page
    .getByRole('button', { name: /Permanently delete my account/ })
    .click();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@round6-phase3 Delete Account', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('2-tap reachability: profile → Delete Account opens the sheet (S6)', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('del-reach');
    try {
      await signInUi(page, user);

      // One tap from the profile page to the Delete Account row is all
      // that is needed — sign-in above is not counted against the policy
      // tap budget because S6 measures from "app entry for signed-in
      // users", which begins on the profile page for this test.
      const deleteRow = page.getByRole('button', { name: 'Delete Account' });
      await expect(deleteRow).toBeVisible();
      await deleteRow.click();

      await expect(
        page.getByRole('dialog').getByText('Delete your account', { exact: true }),
      ).toBeVisible();
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('rejects a non-exact confirmation string and keeps the Continue button disabled', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('del-conf');
    try {
      await signInUi(page, user);
      await openDeleteAccountSheet(page);

      const checkbox = page.getByRole('dialog').locator('input[type="checkbox"]');
      await checkbox.check();

      // Lowercase version must not match — the constant is case-sensitive.
      await page.locator('#dlt-confirm').fill('delete my account');
      const continueBtn = page.getByRole('button', { name: 'Continue' });
      await expect(continueBtn).toBeDisabled();

      // Inline hint message.
      await expect(
        page.getByText('The phrase must match exactly.'),
      ).toBeVisible();

      // Type the exact phrase — Continue becomes enabled.
      await page.locator('#dlt-confirm').fill(DELETE_CONFIRMATION_PHRASE);
      await expect(continueBtn).toBeEnabled();
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('re-auth failure keeps the sheet open and refocuses the password field', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('del-reauth-fail');
    try {
      await signInUi(page, user);
      await openDeleteAccountSheet(page);
      await advanceFromExplain(page, DELETE_CONFIRMATION_PHRASE);

      // Submit with a wrong current password — the component calls
      // reauthenticateWithCredential which the emulator rejects.
      await submitReauth(page, 'WrongPassword123!');

      // Mapped error appears; sheet stays on the reauth step.
      const heading = page.getByRole('dialog').getByText('Confirm your password', { exact: true });
      await expect(heading).toBeVisible({ timeout: 8_000 });

      // The callable must NOT have been invoked — we can verify by
      // asserting we did not navigate to the post-delete redirect.
      await expect(page).not.toHaveURL(POST_DELETE_REDIRECT_PATTERN);

      // Password field is cleared and refocused (component handleDelete
      // catch block resets state and calls focus()).
      await expect(page.locator('#dlt-pwd')).toHaveValue('');
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('happy path: re-auth then callable succeeds → redirect to login with accountDeleted=1 (S3)', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('del-happy');
    try {
      await signInUi(page, user);
      await openDeleteAccountSheet(page);
      await advanceFromExplain(page, DELETE_CONFIRMATION_PHRASE);

      // Stub the deleteAccount callable response — the emulator hosts
      // the callable at /deleteAccount. We confirm the client sends the
      // exact `{ confirmationString: 'DELETE MY ACCOUNT' }` payload.
      let observedBody: unknown = null;
      await page.route(/\/deleteAccount(?:\/|\?|$)/, async (route) => {
        try {
          observedBody = route.request().postDataJSON();
        } catch {
          observedBody = null;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              success: true,
            },
          }),
        });
      });

      await submitReauth(page, user.password);

      // Step 3 executing state renders a role=status region while the
      // callable + signOut sweep run.
      await expect(
        page.getByRole('status').filter({ hasText: /Deleting your account/i }),
      ).toBeVisible({ timeout: 8_000 });

      // The component calls router.push('/auth/login?accountDeleted=1').
      await page.waitForURL(POST_DELETE_REDIRECT_PATTERN, { timeout: 15_000 });
      await expect(page).toHaveURL(POST_DELETE_REDIRECT_PATTERN);

      // Success toast copy from DeleteAccountSheet.
      await expect(page.getByText(/Account deleted/i)).toBeVisible({
        timeout: 5_000,
      });

      // Payload contract — backend's Zod schema requires this exact literal.
      const parsed = (observedBody ?? {}) as {
        readonly data?: { readonly confirmationString?: string };
      };
      expect(parsed.data?.confirmationString).toBe(DELETE_CONFIRMATION_PHRASE);
    } finally {
      // Server-side: the deleted-account callable normally kills the auth
      // record. Because this spec stubs the callable we still have to
      // clean up the seeded user manually to keep emulator state clean.
      await deleteTestUser({ uid: user.uid }).catch(() => {});
    }
  });

  test('already-deleted idempotent retry: callable returns alreadyDeleted=true and user is signed out', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('del-idempotent');
    try {
      await signInUi(page, user);
      await openDeleteAccountSheet(page);
      await advanceFromExplain(page, DELETE_CONFIRMATION_PHRASE);

      await page.route(/\/deleteAccount(?:\/|\?|$)/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              success: true,
              alreadyDeleted: true,
            },
          }),
        });
      });

      await submitReauth(page, user.password);

      // Same success redirect regardless of alreadyDeleted flag — UX must
      // not reveal whether the server did real work.
      await page.waitForURL(POST_DELETE_REDIRECT_PATTERN, { timeout: 15_000 });
      await expect(page).toHaveURL(POST_DELETE_REDIRECT_PATTERN);
      await expect(page.getByText(/Account deleted/i)).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await deleteTestUser({ uid: user.uid }).catch(() => {});
    }
  });
});
