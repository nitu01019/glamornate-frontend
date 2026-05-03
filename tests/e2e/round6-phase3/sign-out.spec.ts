/**
 * Round 6 Phase 3 — Sign-out hardening E2E spec.
 *
 * Covers PHASE_3.md §1 success criterion S5:
 *   signOut clears React Query cache + Zustand stores + FCM token
 *   registration + localStorage (allowlisted prefixes) + sessionStorage.
 *
 * Implementation under test: `src/lib/auth-provider.tsx` calls
 * `sweepClientState` from `src/lib/auth/sign-out-sweeper.ts` on sign-out,
 * which emits a single `console.info('[auth] signOut sweep', summary)`
 * log line we subscribe to for in-browser verification.
 *
 * This spec relies on three real selectors:
 *   - Profile page: role=button, name="Sign Out" (from the Actions card).
 *   - Root redirect: signOut in the profile page pushes the user to `/`.
 *   - Sweep log: `[auth] signOut sweep` prefix from
 *     `src/lib/auth/sign-out-sweeper.ts` (captured via page.on('console')).
 *
 * Assertions:
 *   - localStorage for allowlisted prefixes (glamornate-, glm:, rq-persist-)
 *     is empty after signOut. Matches `CLEARED_LOCAL_STORAGE_PREFIXES`.
 *   - sessionStorage is empty.
 *   - React Query cache is empty — we assert via the structured sweep log,
 *     which records `ok: true` for the `queryClient.clear` step.
 *   - Terminal step `firebase.signOut` fires with `ok: true`.
 */

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import {
  deleteTestUser,
  seedDefaultCustomer,
  type SeedUserResult,
} from '../../helpers/seed-user';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const LOAD_STATE = 'domcontentloaded' as const;
const PROFILE_URL = '/customer/profile';
const LOGIN_URL = '/auth/login';

/** Must stay in sync with CLEARED_LOCAL_STORAGE_PREFIXES in sign-out-sweeper.ts. */
const ALLOWLISTED_PREFIXES = [
  'glamornate-',
  'glamornate_',
  'glm:',
  'location:',
  'cart:',
  'rq-persist-',
] as const;

/** Prefix the sweeper logs once per sign-out event. */
const SWEEP_LOG_PREFIX = '[auth] signOut sweep';

// Structured sweep summary as serialised by console.info in sweeper.
interface SweepSummary {
  readonly totalMs: number;
  readonly allOk: boolean;
  readonly signedOut: boolean;
  readonly steps: readonly {
    readonly step: string;
    readonly ok: boolean;
    readonly ms: number;
    readonly err?: string;
  }[];
}

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

/**
 * Attach a console listener that captures the structured sweep summary.
 * Returns a getter that resolves to the first observed summary.
 */
function captureSweepSummary(page: Page): () => Promise<SweepSummary | null> {
  let latest: SweepSummary | null = null;
  const handler = (msg: ConsoleMessage) => {
    if (msg.type() !== 'info') return;
    const text = msg.text();
    if (!text.startsWith(SWEEP_LOG_PREFIX)) return;
    try {
      const payloadStart = text.indexOf('{');
      if (payloadStart === -1) return;
      const raw = text.slice(payloadStart);
      const parsed = JSON.parse(raw) as SweepSummary;
      latest = parsed;
    } catch {
      // Ignore — some runtimes stringify differently.
    }
  };
  page.on('console', handler);
  return async () => latest;
}

async function seedClientStateBeforeSignOut(page: Page): Promise<void> {
  // Populate storage and caches with keys that should be purged on
  // signOut. We add one allowlisted key per prefix, plus one foreign
  // key that MUST survive the purge.
  await page.evaluate((prefixes) => {
    window.localStorage.setItem('unrelated-vendor-key', 'keep-me');
    for (const prefix of prefixes) {
      window.localStorage.setItem(`${prefix}spec-seeded`, 'scrub-me');
    }
    window.sessionStorage.setItem('anything', 'temporary');
  }, [...ALLOWLISTED_PREFIXES]);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('@round6-phase3 Sign-out hardening (S5)', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('signOut purges allowlisted localStorage keys, empties sessionStorage, leaves foreign keys alone', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('so-storage');
    try {
      await signInUi(page, user);
      await seedClientStateBeforeSignOut(page);

      const getSummary = captureSweepSummary(page);

      const signOutBtn = page.getByRole('button', { name: 'Sign Out' });
      await signOutBtn.scrollIntoViewIfNeeded();
      await signOutBtn.click();

      // Auth-provider pushes to '/' after a successful sweep.
      await page.waitForURL(/\/$/, { timeout: 15_000 });

      const remaining = await page.evaluate((prefixes) => {
        const all: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const k = window.localStorage.key(i);
          if (k) all.push(k);
        }
        const allowlisted = all.filter((k) =>
          prefixes.some((p) => k.startsWith(p)),
        );
        return {
          allowlistedRemaining: allowlisted,
          foreignRemaining: all.filter((k) =>
            !prefixes.some((p) => k.startsWith(p)),
          ),
          sessionLength: window.sessionStorage.length,
        };
      }, [...ALLOWLISTED_PREFIXES]);

      // Every allowlisted key is gone.
      expect(remaining.allowlistedRemaining).toEqual([]);
      // sessionStorage is fully cleared.
      expect(remaining.sessionLength).toBe(0);
      // The foreign vendor key survives — the sweeper MUST NOT nuke unrelated keys.
      expect(remaining.foreignRemaining).toContain('unrelated-vendor-key');

      // Sweep summary: every step ok + terminal signOut ran.
      const summary = await getSummary();
      expect(summary).not.toBeNull();
      expect(summary?.signedOut).toBe(true);
      expect(summary?.allOk).toBe(true);

      // Individual steps from § 3.3 of PHASE_3.md are all represented.
      const expectedSteps = [
        'fcm.deleteToken',
        'queryClient.clear',
        'zustand.reset',
        'localStorage.purge',
        'sessionStorage.clear',
        'serviceWorker.unregister',
        'firebase.signOut',
      ];
      const observedSteps = (summary?.steps ?? []).map((s) => s.step);
      for (const step of expectedSteps) {
        expect(observedSteps).toContain(step);
      }
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('React Query cache is empty after signOut (queryClient.clear ran OK)', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('so-rq');
    try {
      await signInUi(page, user);
      const getSummary = captureSweepSummary(page);

      await page.getByRole('button', { name: 'Sign Out' }).click();
      await page.waitForURL(/\/$/, { timeout: 15_000 });

      const summary = await getSummary();
      expect(summary).not.toBeNull();
      const queryStep = summary?.steps.find((s) => s.step === 'queryClient.clear');
      expect(queryStep).toBeDefined();
      expect(queryStep?.ok).toBe(true);
      expect(queryStep?.err).toBeUndefined();
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('FCM token is NOT registered post-signOut (fcm.deleteToken step reports ok)', async ({
    page,
  }) => {
    // The current frontend does not register FCM (see PHASE_3.md § 3.3
    // inline comment). The sweeper still runs the `fcm.deleteToken`
    // step — with no FcmHandle it must no-op and report ok: true.
    const user = await seedDefaultCustomer('so-fcm');
    try {
      await signInUi(page, user);
      const getSummary = captureSweepSummary(page);

      await page.getByRole('button', { name: 'Sign Out' }).click();
      await page.waitForURL(/\/$/, { timeout: 15_000 });

      const summary = await getSummary();
      expect(summary).not.toBeNull();
      const fcmStep = summary?.steps.find((s) => s.step === 'fcm.deleteToken');
      expect(fcmStep).toBeDefined();
      expect(fcmStep?.ok).toBe(true);

      // Belt-and-braces: if Phase 4 wires FCM and stores a token in
      // localStorage under `glm:fcm-token`, it will be allowlisted and
      // purged by the localStorage step anyway.
      const tokenKey = await page.evaluate(
        () => window.localStorage.getItem('glm:fcm-token'),
      );
      expect(tokenKey).toBeNull();
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });

  test('terminal firebase.signOut always runs, even when upstream sweep has an issue', async ({
    page,
  }) => {
    const user = await seedDefaultCustomer('so-terminal');
    try {
      await signInUi(page, user);
      const getSummary = captureSweepSummary(page);

      // Poison sessionStorage with a property that throws on `.clear()`
      // so we exercise the "terminal step still fires" invariant.
      await page.evaluate(() => {
        const original = window.sessionStorage.clear;
        Object.defineProperty(window.sessionStorage, 'clear', {
          configurable: true,
          value: () => {
            // Restore after one failure so subsequent specs do not break.
            Object.defineProperty(window.sessionStorage, 'clear', {
              configurable: true,
              value: original,
            });
            throw new Error('sessionStorage.clear blown');
          },
        });
      });

      await page.getByRole('button', { name: 'Sign Out' }).click();
      await page.waitForURL(/\/$/, { timeout: 15_000 });

      const summary = await getSummary();
      expect(summary).not.toBeNull();
      // Terminal step must be ok regardless.
      expect(summary?.signedOut).toBe(true);
      // At least one upstream step should carry the error message.
      const failing = (summary?.steps ?? []).filter((s) => !s.ok);
      expect(failing.length).toBeGreaterThanOrEqual(1);
    } finally {
      await deleteTestUser({ uid: user.uid });
    }
  });
});
