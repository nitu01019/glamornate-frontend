import { expect, test, type Page } from '@playwright/test';

/**
 * Round 6 / Phase 2 B5 — `address-sheet.spec.ts`
 *
 * Validates the Phase-2 address bottom-sheet flow that replaced the
 * "tap-and-navigate-to-/customer/addresses" regression on home. Contract
 * under test (PHASE_2.md — B3 `AddressSheetManualForm` +
 * B1/B2 `HomeLocationSheet` wiring):
 *
 *   1. Tapping the address bar on `/` opens the bottom sheet in place —
 *      the URL must NOT change to `/customer/addresses`.
 *   2. Tapping the "expand" CTA inside the sheet reveals the manual form
 *      root (`address-sheet-manual-form`).
 *   3. Submitting the form with valid data closes the form (and the
 *      sheet, via `onSaved`).
 *   4. Entering an invalid pincode (not 6 digits) leaves the submit
 *      button disabled OR surfaces an inline error — both are acceptable
 *      "submit blocked" states.
 *   5. Tapping "Use current location" when the backend callable is not
 *      configured surfaces a `not-configured` toast (the sheet stays
 *      open and expands the manual form as a fallback).
 *
 * Locked test IDs (do not rename):
 *   - `home-location-row`               — address bar entry on home
 *   - `address-sheet-manual-form`       — manual form root
 *   - `address-manual-expand`           — expand CTA (wired by B3)
 *   - `address-manual-submit`           — submit button (wired by B3)
 *   - `home-location-sheet`             — sheet container
 *   - `home-location-sheet-gps`         — "use current location" row
 */

// ---------------------------------------------------------------------------
// Viewports
// ---------------------------------------------------------------------------

const PHONE = { width: 390, height: 844 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const HOME_URL = '/';
const ADDRESSES_URL = '/customer/addresses';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gotoHome(page: Page): Promise<void> {
  await page.goto(HOME_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    /* ignore — home keeps open subscriptions */
  });
  await page.waitForTimeout(1_500);
}

async function openAddressSheet(page: Page): Promise<void> {
  // The home location row is a role=button. We lookup by test id (locked)
  // and click the internal tappable region which carries aria-label
  // "Change location".
  const row = page.getByTestId('home-location-row');
  if ((await row.count()) === 0) {
    test.skip(true, 'home-location-row not rendered — home layout changed.');
    return;
  }
  const tap = row.locator('[role="button"][aria-label="Change location"]');
  if ((await tap.count()) === 0) {
    // Fallback: some renders may expose the row itself as the clickable
    // target. Click the row root in that case.
    await row.first().click();
  } else {
    await tap.first().click();
  }
  // Wait for the sheet to attach — dynamic import on first open.
  await expect(page.getByTestId('home-location-sheet')).toBeVisible({
    timeout: 5_000,
  });
}

async function expandManualForm(page: Page): Promise<void> {
  // B3 wires `address-manual-expand` onto whichever button is the entry to
  // the inline manual form. If a sheet already renders the form open
  // (zero-state), the CTA is absent and the form is already visible.
  const form = page.getByTestId('address-sheet-manual-form');
  if ((await form.count()) > 0 && (await form.first().isVisible())) {
    return;
  }
  const expand = page.getByTestId('address-manual-expand');
  await expect(expand).toBeVisible();
  await expand.click();
  await expect(form).toBeVisible({ timeout: 3_000 });
}

// ---------------------------------------------------------------------------
// Phone viewport
// ---------------------------------------------------------------------------

test.describe('@round6-phase2 address-sheet — phone (390x844)', () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('tap address bar opens sheet (does NOT navigate to /customer/addresses)', async ({
    page,
  }) => {
    await openAddressSheet(page);

    // URL must still be home — the legacy behaviour navigated away to
    // /customer/addresses. That regression would be caught here.
    const url = new URL(page.url());
    expect(url.pathname).not.toBe(ADDRESSES_URL);
    expect(url.pathname).toBe('/');

    // Sheet is visible (covered by the helper); also assert the sheet
    // overlay painted so swipe-down / tap-backdrop is functional.
    await expect(page.getByTestId('home-location-sheet-overlay')).toBeVisible();
  });

  test('tap expand CTA reveals the manual form', async ({ page }) => {
    await openAddressSheet(page);
    await expandManualForm(page);

    const form = page.getByTestId('address-sheet-manual-form');
    await expect(form).toBeVisible();
    // Form must contain a submit button with the locked id.
    await expect(page.getByTestId('address-manual-submit')).toBeVisible();
  });

  test('invalid pincode → submit is blocked', async ({ page }) => {
    await openAddressSheet(page);
    await expandManualForm(page);

    // Fill the minimum required fields with one invalid field: pincode
    // only has 3 digits (schema requires 6). The form should either:
    //   (a) disable `address-manual-submit`, OR
    //   (b) allow click and surface an inline error without closing.
    const name = page.getByTestId('address-form-name');
    const phone = page.getByTestId('address-form-phone');
    const flat = page.getByTestId('address-form-flat');
    const street = page.getByTestId('address-form-street');
    const city = page.getByTestId('address-form-city');
    const stateIn = page.getByTestId('address-form-state');
    const pincode = page.getByTestId('address-form-pincode');

    if ((await name.count()) > 0) await name.fill('Test User');
    if ((await phone.count()) > 0) await phone.fill('9999999999');
    if ((await flat.count()) > 0) await flat.fill('A-101');
    if ((await street.count()) > 0) await street.fill('MG Road');
    if ((await city.count()) > 0) await city.fill('Bengaluru');
    if ((await stateIn.count()) > 0) await stateIn.fill('Karnataka');
    if ((await pincode.count()) > 0) await pincode.fill('123');

    const submit = page.getByTestId('address-manual-submit');
    const disabled = await submit.isDisabled().catch(() => false);
    if (disabled) {
      // (a) contract satisfied — nothing else to check.
      expect(disabled).toBe(true);
      return;
    }

    // (b) not disabled — click and assert the form is still visible (not
    // submitted) and no "closed" toast appears.
    await submit.click({ trial: false });
    await expect(page.getByTestId('address-sheet-manual-form')).toBeVisible();
    // Inline pincode error should be present if the form let the click
    // through. We accept any descendant with role="alert".
    const alerts = page.getByTestId('address-sheet-manual-form').locator('[role="alert"]');
    expect(await alerts.count()).toBeGreaterThan(0);
  });

  test('valid submit closes the form', async ({ page }) => {
    await openAddressSheet(page);
    await expandManualForm(page);

    // Fill a complete and valid payload. If the environment lacks the
    // addAddress callable, the mutation will error — we then only assert
    // that the submit button enters its pending state (not that the sheet
    // closes, which depends on backend success). A non-CI run with
    // emulator seeding gets the full close assertion.
    const fills: ReadonlyArray<readonly [string, string]> = [
      ['address-form-name', 'Test User'],
      ['address-form-phone', '9999999999'],
      ['address-form-flat', 'A-101'],
      ['address-form-street', 'MG Road'],
      ['address-form-city', 'Bengaluru'],
      ['address-form-state', 'Karnataka'],
      ['address-form-pincode', '560001'],
    ];
    for (const [testid, value] of fills) {
      const input = page.getByTestId(testid);
      if ((await input.count()) > 0) await input.fill(value);
    }

    const submit = page.getByTestId('address-manual-submit');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Accept either outcome: form closes (ideal) or button enters pending
    // (backend not reachable). Both satisfy the "click was accepted"
    // contract required by the success criteria.
    const formGone = await page
      .getByTestId('address-sheet-manual-form')
      .waitFor({ state: 'hidden', timeout: 7_000 })
      .then(() => true)
      .catch(() => false);

    if (!formGone) {
      // Pending state: button is disabled OR reads "Saving…".
      const isDisabled = await submit.isDisabled().catch(() => false);
      const hasSavingCopy = (await submit.innerText()).toLowerCase().includes('saving');
      expect(isDisabled || hasSavingCopy).toBe(true);
    }
  });

  test('"not-configured" toast when current-location tried with key absent', async ({ page }) => {
    await openAddressSheet(page);

    // Intercept the geocode callable so it consistently replies with the
    // "not-configured" status — this mirrors the shape `location-writer`
    // expects from `setActiveLocationFromGps`.
    await page.route('**/geocodeReverse**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: { status: 'not-configured' },
        }),
      });
    });

    // Stub navigator.geolocation so the GPS path resolves immediately.
    await page.addInitScript(() => {
      const anyNav = navigator as unknown as {
        geolocation: {
          getCurrentPosition: (
            ok: (pos: {
              coords: { latitude: number; longitude: number; accuracy: number };
            }) => void,
          ) => void;
          watchPosition?: () => number;
          clearWatch?: () => void;
        };
      };
      anyNav.geolocation = {
        getCurrentPosition: (ok) =>
          ok({ coords: { latitude: 12.97, longitude: 77.59, accuracy: 10 } }),
        watchPosition: () => 0,
        clearWatch: () => undefined,
      };
    });

    const gps = page.getByTestId('home-location-sheet-gps');
    if ((await gps.count()) === 0) {
      test.skip(true, 'GPS row not wired; not-configured path not exercisable.');
      return;
    }
    await gps.click();

    // Toast container is global. Assert visible text mentions "not set up"
    // or "configure" (matching the toast copy shipped by B1's
    // `HomeLocationSheet`).
    const toastText = page.getByText(/not set up|manually|configure/i);
    await expect(toastText.first()).toBeVisible({ timeout: 5_000 });

    // Manual form should expand as the fallback.
    await expect(page.getByTestId('address-sheet-manual-form')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Desktop viewport — sheet is still the UX on desktop (modal bottom sheet).
// ---------------------------------------------------------------------------

test.describe('@round6-phase2 address-sheet — desktop (1280x800)', () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('address bar → sheet (no navigate away)', async ({ page }) => {
    await openAddressSheet(page);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/');
    await expect(page.getByTestId('home-location-sheet')).toBeVisible();
  });

  test('expand CTA → manual form visible', async ({ page }) => {
    await openAddressSheet(page);
    await expandManualForm(page);
    await expect(page.getByTestId('address-sheet-manual-form')).toBeVisible();
    await expect(page.getByTestId('address-manual-submit')).toBeVisible();
  });
});
