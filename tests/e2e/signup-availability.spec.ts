// @flameguard: no-amber-pill
// All scenarios in this file regression-guard against the amber
// "Couldn't check availability" pill. If any scenario renders that string,
// the Phase 7 silent-fail pattern has regressed.

/**
 * Signup availability — E2E regression guard.
 *
 * Verifies the four critical behaviours of the `useSignupAvailability` +
 * `useEmailTypoSuggestion` integration on the register page:
 *
 *   1. A taken email shows the red "Already registered" pill after blur.
 *   2. A fresh email shows no pill (silent OK).
 *   3. A typo domain (`@gmial.com`) shows an interactive suggestion button.
 *   4. A callable failure never surfaces the amber error pill; the form
 *      remains submittable.
 *
 * Implementation under test:
 *   - Register page:   `src/app/auth/register/page.tsx`
 *   - Availability:    `src/hooks/useSignupAvailability.ts`
 *   - Typo detection:  `src/hooks/useEmailTypoSuggestion.ts`
 *   - Callable:        `checkSignupAvailability` via `firebase-client-wrapper.ts`
 *                      (pinned to `us-central1`)
 *
 * Callable URL pattern (emulator + production):
 *   - Emulator:    `http://127.0.0.1:5001/<projectId>/us-central1/checkSignupAvailability`
 *   - Production:  `https://us-central1-<projectId>.cloudfunctions.net/checkSignupAvailability`
 *   We intercept with a broad pattern that covers both.
 *
 * Taken-email pre-condition:
 *   - Uses `seedTestUser` from `tests/helpers/seed-user.ts` against the
 *     Auth emulator. The same email is cleaned up in a `finally` block.
 *   - The callable backend also queries Auth, so any email seeded into the
 *     Auth emulator will be returned as `{ available: false }`.
 *
 * NOTE FOR THE RUNNER:
 *   These specs compile against real selectors in the component. They require
 *   (a) the Auth + Functions emulator running, (b) a Next dev server wired to
 *   `FIREBASE_AUTH_EMULATOR_HOST` and `FIREBASE_FUNCTIONS_EMULATOR_HOST`.
 *   Agent 6's mandate is to author the specs, not to execute them — a
 *   subsequent CI phase will run them.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  seedTestUser,
  deleteTestUser,
  type SeedUserResult,
} from '../helpers/seed-user';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const LOAD_STATE = 'domcontentloaded' as const;
const REGISTER_URL = '/auth/register';

/**
 * Firebase Functions callable URL pattern — matches both the local emulator
 * and production cloudfunctions.net endpoints for checkSignupAvailability.
 *
 * Emulator shape:
 *   http://127.0.0.1:5001/glamornate-758c6/us-central1/checkSignupAvailability
 * Production shape:
 *   https://us-central1-glamornate-758c6.cloudfunctions.net/checkSignupAvailability
 *
 * The `httpsCallable` SDK adds a trailing `/` + JSON body via POST, but
 * `page.route` matches on the URL prefix so no trailing-slash concern.
 */
const AVAILABILITY_CALLABLE_RE = /checkSignupAvailability/;

/**
 * The exact amber pill copy rendered by `AvailabilityPill` when status is
 * `'error'`. Phase 7 guarantees this string is NEVER rendered (silent-fail).
 */
const AMBER_PILL_TEXT = "Couldn't check availability";

/**
 * The red taken-indicator copy rendered by `AvailabilityPill` when
 * status is `'taken'` and field is `'email'`.
 */
const TAKEN_INDICATOR_TEXT = 'Already registered. Try signing in instead?';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the register page and wait until the DOM is ready.
 */
async function gotoRegister(page: Page): Promise<void> {
  await page.goto(REGISTER_URL);
  await page.waitForLoadState(LOAD_STATE);
}

/**
 * Fill the email input, then blur it (tab away) so `onBlur={triggerEmailCheck}`
 * fires and the availability hook runs its immediate check.
 *
 * We also fill the name field first so the email field is not the very first
 * focusable element — this ensures that pressing Tab from email actually moves
 * focus away (triggering blur) rather than doing nothing on some browsers.
 */
async function fillAndBlurEmail(page: Page, email: string): Promise<void> {
  // Ensure name field is populated so the form focus chain is well-defined.
  await page.locator('#name').fill('Test User');
  await page.locator('#email').fill(email);
  // Tab away from the email field to trigger the blur event.
  await page.locator('#email').press('Tab');
}

/**
 * Assert that the amber "Couldn't check availability" pill is absent from the
 * page. This is the core regression guard shared by every scenario.
 */
async function assertNoAmberPill(page: Page): Promise<void> {
  await expect(
    page.getByText(AMBER_PILL_TEXT, { exact: false }),
  ).not.toBeVisible();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Signup availability', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  // Run serially: Auth emulator seed/delete operations must not race across
  // parallel workers using the same email address.
  test.describe.configure({ mode: 'serial' });

  // ------------------------------------------------------------------
  // Scenario 1 — taken email shows red taken indicator on blur
  // ------------------------------------------------------------------

  test('taken email shows red taken indicator on blur', async ({ page }) => {
    // Seed a known account into the Auth emulator so the callable backend
    // reports `{ available: false }` for this email.
    const seededEmail = 'qa-avail-taken@glamornate.test';
    const user: SeedUserResult = await seedTestUser({
      email: seededEmail,
      password: 'TakenAcc42!',
      emailVerified: true,
    });

    try {
      await gotoRegister(page);
      await fillAndBlurEmail(page, seededEmail);

      // The red taken indicator must become visible within a reasonable
      // network round-trip to the Functions emulator.
      const takenIndicator = page.getByText(TAKEN_INDICATOR_TEXT, {
        exact: false,
      });
      await expect(takenIndicator).toBeVisible({ timeout: 10_000 });

      // Core regression guard: amber pill must never appear.
      await assertNoAmberPill(page);
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  // ------------------------------------------------------------------
  // Scenario 2 — available email shows no indicator (silent OK)
  // ------------------------------------------------------------------

  test('available email shows no indicator (silent ok)', async ({ page }) => {
    // Use a unique timestamp-scoped email that is guaranteed not to exist in
    // the emulator so the callable returns `{ available: true }`.
    const freshEmail = `available-${Date.now()}@example.com`;

    await gotoRegister(page);
    await fillAndBlurEmail(page, freshEmail);

    // Give the hook enough time to resolve (callable round-trip + debounce).
    // We assert presence of the "Available" text OR absence of the taken
    // indicator. Either outcome is correct for a fresh email, but we must
    // not see the taken indicator.
    await expect(
      page.getByText(TAKEN_INDICATOR_TEXT, { exact: false }),
    ).not.toBeVisible({ timeout: 10_000 });

    // Regression guard: amber pill must never appear.
    await assertNoAmberPill(page);

    // The submit button must not be disabled due to availability state.
    // We do not click it (that would require filling all fields); we just
    // confirm the button is not stuck in a "taken" disabled state.
    const submitButton = page.getByRole('button', { name: /Create Account/i });
    await expect(submitButton).toBeVisible();
    // The button may still be disabled due to empty password fields — that is
    // correct form-validation behaviour, not an availability-block. We only
    // assert it is not aria-invalid due to email being "taken".
    await expect(page.locator('#email')).not.toHaveAttribute('aria-invalid', 'true');
  });

  // ------------------------------------------------------------------
  // Scenario 3 — @gmial.com triggers typo suggestion on blur
  // ------------------------------------------------------------------

  test('@gmial.com triggers typo suggestion on blur', async ({ page }) => {
    // `useEmailTypoSuggestion` is a pure client-side hook — no callable needed.
    // It fires synchronously on every render once the email state is set.
    await gotoRegister(page);

    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('nitish@gmial.com');
    // Blur by tabbing away.
    await page.locator('#email').press('Tab');

    // The suggestion is rendered as a <button> containing the suggestion text
    // "Did you mean nitish@gmail.com?" — see register/page.tsx lines 262-273.
    const suggestionButton = page.getByRole('button', {
      name: /did you mean.*@gmail\.com/i,
    });
    await expect(suggestionButton).toBeVisible({ timeout: 5_000 });

    // Clicking the suggestion must update the email input to the corrected
    // address. The onClick handler extracts the suggestion via regex and
    // calls setEmail(match[1]).
    await suggestionButton.click();

    await expect(page.locator('#email')).toHaveValue('nitish@gmail.com');

    // Regression guard: amber pill must never appear.
    await assertNoAmberPill(page);
  });

  // ------------------------------------------------------------------
  // Scenario 4 — callable failure does not show amber pill; form remains
  //              submittable (silent-fail contract from Phase 7)
  // ------------------------------------------------------------------

  test('callable failure does not show amber pill, form remains submittable', async ({
    page,
  }) => {
    // Stub the checkSignupAvailability callable to return HTTP 500.
    // `useSignupAvailability` catches this, logs a warning, retries once after
    // 1 s, then sets status → 'idle' (never 'error'). The AvailabilityPill
    // must therefore never render the amber copy.
    await page.route(AVAILABILITY_CALLABLE_RE, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { status: 'INTERNAL', message: 'simulated backend failure' },
        }),
      });
    });

    const testEmail = `silent-fail-${Date.now()}@example.com`;

    await gotoRegister(page);

    // Fill all fields to a state where the submit button would be enabled
    // (valid password strength + matching confirm password).
    await page.locator('#name').fill('Silent Fail User');
    await page.locator('#email').fill(testEmail);
    await page.locator('#email').press('Tab');

    // Wait long enough for both the initial attempt and the one-shot retry
    // (RETRY_DELAY_MS = 1000 ms) to complete.  After both failures the hook
    // resolves to 'idle', so the email field must not be aria-invalid.
    await page.waitForTimeout(2_500);

    // Primary assertion: amber pill must never appear at any point.
    await assertNoAmberPill(page);

    // The email field must not carry aria-invalid="true" (which would
    // indicate the hook erroneously set status to 'taken').
    await expect(page.locator('#email')).not.toHaveAttribute('aria-invalid', 'true');

    // Fill the remaining fields so we can check the submit button is enabled.
    const strongPassword = 'StrongPass99!';
    await page.locator('#password').fill(strongPassword);
    await page.locator('#confirmPassword').fill(strongPassword);

    // The submit button must be enabled: the callable failure should not
    // block the user from attempting to create an account.
    const submitButton = page.getByRole('button', { name: /Create Account/i });
    await expect(submitButton).not.toBeDisabled();

    // Unroute so subsequent specs (if any) are unaffected.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});
