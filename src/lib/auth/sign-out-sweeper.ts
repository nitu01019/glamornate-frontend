/**
 * Sign-out state sweeper.
 *
 * Executes every client-side cleanup step in a deterministic order so that a
 * partial failure never leaves the user "half signed-out". Every step is
 * wrapped in its own try/catch — a throw in one does not short-circuit the
 * rest, and the final Firebase Auth sign-out is guaranteed to run.
 *
 * Contract:
 *   - The function is idempotent. Calling it while already signed out is a
 *     cheap no-op — each step tolerates missing state.
 *   - The returned `SweepResult` carries a per-step audit trail so QA can
 *     see exactly which piece failed without replaying the session.
 *   - The sweeper NEVER calls `console.log` — it emits a single
 *     `console.info('[auth] signOut sweep', summary)` via the bound logger
 *     so the structured entry shows up once per sign-out event.
 */

import type { QueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A Zustand store handle that exposes at least one of `reset` / `clear` /
 * `disconnect` / `clearMessages` / `clearCart`. The sweeper will call the
 * first method that exists on the returned state object.
 *
 * We accept the raw `getState` function (or a thunk that returns it) so
 * callers can pass `() => useCartStore.getState()` without the sweeper
 * depending on Zustand's internals.
 */
export type StoreResetMethod =
  | 'reset'
  | 'clear'
  | 'disconnect'
  | 'clearMessages'
  | 'clearCart';

export interface StoreHandle {
  /** Short label used in the audit trail (e.g. `'cart'`, `'chat'`). */
  readonly name: string;
  /** Returns the current state object for the store. */
  readonly getState: () => Record<string, unknown>;
  /**
   * Ordered list of methods to try. The first one that exists on the state
   * object will be invoked. Defaults to the full list when omitted.
   */
  readonly methods?: readonly StoreResetMethod[];
}

/**
 * FCM messaging facade. Kept optional because the app does not register for
 * push on every build (e.g. web without service worker, Capacitor-only
 * native push). The sweeper no-ops gracefully when both `messaging` and
 * `token` are null.
 */
export interface FcmHandle {
  /** The Firebase Messaging instance, or null if not initialized. */
  readonly messaging: unknown | null;
  /**
   * Returns the currently registered FCM token, or null if none.
   * Called before `deleteToken` so we can skip the call when there's nothing
   * to unregister.
   */
  readonly getTokenSafely?: () => Promise<string | null>;
  /**
   * Deletes the current token registration. Should resolve on success or
   * when there is nothing to delete. Throw to signal a genuine error.
   */
  readonly deleteToken?: (messaging: unknown) => Promise<void>;
}

export interface SweepCtx {
  /** React Query client whose cache + in-flight queries must be cleared. */
  readonly queryClient: Pick<QueryClient, 'cancelQueries' | 'clear'> | null;
  /** Zustand stores to reset, in the order they should be visited. */
  readonly stores: readonly StoreHandle[];
  /**
   * Override for `window.localStorage`. Tests inject a fake. When omitted,
   * the sweeper reads from `globalThis.localStorage`.
   */
  readonly localStorage?: Storage;
  /**
   * Override for `window.sessionStorage`. Tests inject a fake. When
   * omitted, the sweeper reads from `globalThis.sessionStorage`.
   */
  readonly sessionStorage?: Storage;
  /**
   * Optional FCM handle. When provided, the sweeper attempts to unregister
   * the current push token. All failures are captured in the audit trail.
   */
  readonly fcm?: FcmHandle;
  /**
   * Override for `caches` and service worker registration. Tests inject
   * spy objects. When omitted, the sweeper reads from `globalThis`.
   */
  readonly caches?: CacheStorage;
  /**
   * Returns the set of active service worker registrations. Default uses
   * `navigator.serviceWorker.getRegistrations()` when available.
   */
  readonly getServiceWorkerRegistrations?: () => Promise<
    readonly { readonly unregister: () => Promise<boolean> }[]
  >;
  /**
   * Firebase Auth sign-out callable. This is the final step and MUST run
   * even if earlier steps fail. Injected so the sweeper does not import
   * `firebase/auth` directly (keeps the unit test environment clean).
   */
  readonly firebaseSignOut: () => Promise<void>;
  /**
   * Called after every step with the monotonic clock reading from
   * `performance.now()`. Tests can override with a fake clock.
   */
  readonly now?: () => number;
}

export interface SweepStepResult {
  readonly step: string;
  readonly ok: boolean;
  /** Elapsed milliseconds for this step. */
  readonly ms: number;
  /** Short human-readable error summary when `ok === false`. */
  readonly err?: string;
}

export interface SweepResult {
  /** Ordered audit trail — useful for log slurping. */
  readonly steps: readonly SweepStepResult[];
  /** Total elapsed milliseconds (sum across all steps). */
  readonly totalMs: number;
  /** True iff every step reported `ok: true`. */
  readonly allOk: boolean;
  /** True iff the terminal firebaseSignOut step succeeded. */
  readonly signedOut: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * localStorage keys that belong to Glamornate and are safe to purge on
 * sign-out. We never nuke unrelated keys — a third-party widget or browser
 * extension might be using the same origin.
 *
 * Each prefix is documented so future maintainers know why it's here:
 * - `glamornate-`: legacy app-owned keys (e.g. `glamornate-cart`,
 *   `glamornate-popup-seen`, `glamornate-rq-cache-v1`).
 * - `glamornate_`: legacy underscore variant (`glamornate_user_location`).
 * - `glm:`: forward-looking namespaced keys introduced by Phase 3 planner.
 * - `location:`: Round 5 location-writer keys (future).
 * - `cart:`: future cart v2 namespacing.
 * - `rq-persist-`: React Query persister alt key shape.
 */
export const CLEARED_LOCAL_STORAGE_PREFIXES: readonly string[] = [
  'glamornate-',
  'glamornate_',
  'glm:',
  'location:',
  'cart:',
  'rq-persist-',
];

const log = logger.child({ component: 'signOutSweeper' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function timed(
  now: () => number,
  step: string,
  fn: () => Promise<void> | void,
): Promise<SweepStepResult> {
  const start = now();
  try {
    await fn();
    return { step, ok: true, ms: Math.max(0, now() - start) };
  } catch (error: unknown) {
    return {
      step,
      ok: false,
      ms: Math.max(0, now() - start),
      err: safeErrorMessage(error),
    };
  }
}

function resolveStorage(
  candidate: Storage | undefined,
  fallbackKey: 'localStorage' | 'sessionStorage',
): Storage | null {
  if (candidate) return candidate;
  if (typeof globalThis === 'undefined') return null;
  const maybe = (globalThis as unknown as Record<string, Storage | undefined>)[fallbackKey];
  return maybe ?? null;
}

function keyMatchesAllowedPrefix(key: string): boolean {
  for (const prefix of CLEARED_LOCAL_STORAGE_PREFIXES) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

function callFirstAvailable(state: Record<string, unknown>, methods: readonly StoreResetMethod[]): {
  called: StoreResetMethod | null;
} {
  for (const method of methods) {
    const candidate = state[method];
    if (typeof candidate === 'function') {
      // Immutability note: we intentionally do not .bind() here — Zustand
      // actions already capture their own `set`/`get` closures, so calling
      // them on the detached state snapshot is safe.
      (candidate as (...args: unknown[]) => unknown)();
      return { called: method };
    }
  }
  return { called: null };
}

// ---------------------------------------------------------------------------
// Individual step implementations
// ---------------------------------------------------------------------------

async function stepUnregisterFcm(fcm: FcmHandle | undefined): Promise<void> {
  if (!fcm || !fcm.messaging || !fcm.deleteToken) return;
  // Optional: skip the deleteToken call when we know there is no token.
  if (fcm.getTokenSafely) {
    const token = await fcm.getTokenSafely();
    if (!token) return;
  }
  await fcm.deleteToken(fcm.messaging);
}

async function stepClearQueryClient(
  queryClient: SweepCtx['queryClient'],
): Promise<void> {
  if (!queryClient) return;
  // Cancel first to abort any in-flight refetches before the state dies.
  await queryClient.cancelQueries();
  queryClient.clear();
}

function stepResetStores(stores: readonly StoreHandle[]): { swept: readonly string[] } {
  const swept: string[] = [];
  const defaultMethods: readonly StoreResetMethod[] = [
    'reset',
    'clearCart',
    'clear',
    'clearMessages',
    'disconnect',
  ];
  for (const store of stores) {
    let state: Record<string, unknown>;
    try {
      state = store.getState();
    } catch {
      // Skip stores whose getState throws (e.g. torn-down provider).
      continue;
    }
    const methods = store.methods ?? defaultMethods;
    const { called } = callFirstAvailable(state, methods);
    if (called) {
      swept.push(`${store.name}#${called}`);
    }
  }
  return { swept };
}

function stepClearLocalStoragePrefixes(storage: Storage | null): { removed: number } {
  if (!storage) return { removed: 0 };
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && keyMatchesAllowedPrefix(key)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
  return { removed: toRemove.length };
}

function stepClearSessionStorage(storage: Storage | null): void {
  if (!storage) return;
  storage.clear();
}

async function stepUnregisterServiceWorkers(ctx: SweepCtx): Promise<void> {
  // Clear cache storage first so any still-active SW can't re-hydrate from
  // a stale response before we pull it.
  const cacheStorage =
    ctx.caches ??
    (typeof globalThis !== 'undefined'
      ? ((globalThis as unknown as { caches?: CacheStorage }).caches ?? null)
      : null);

  if (cacheStorage) {
    const keys = await cacheStorage.keys();
    await Promise.all(
      keys.map(async (key) => {
        try {
          await cacheStorage.delete(key);
        } catch (error: unknown) {
          log.warn('cache.delete failed', { key, err: safeErrorMessage(error) });
        }
      }),
    );
  }

  const getRegs =
    ctx.getServiceWorkerRegistrations ??
    (async () => {
      if (typeof navigator === 'undefined') return [];
      const sw = (navigator as Navigator & { serviceWorker?: ServiceWorkerContainer }).serviceWorker;
      if (!sw || typeof sw.getRegistrations !== 'function') return [];
      try {
        const regs = await sw.getRegistrations();
        return regs;
      } catch {
        return [];
      }
    });

  const registrations = await getRegs();
  await Promise.all(
    registrations.map(async (reg) => {
      try {
        await reg.unregister();
      } catch (error: unknown) {
        log.warn('serviceWorker.unregister failed', { err: safeErrorMessage(error) });
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute the full client-state sweep.
 *
 * Ordering (from PHASE_3 § 3.3):
 *   1. Unregister FCM token (if any)
 *   2. Cancel + clear React Query cache
 *   3. Reset every Zustand store
 *   4. Remove known-prefix localStorage keys
 *   5. sessionStorage.clear()
 *   6. Unregister service workers + clear caches
 *   7. Firebase Auth sign-out (ALWAYS runs, even if earlier steps threw)
 */
export async function sweepClientState(ctx: SweepCtx): Promise<SweepResult> {
  const now = ctx.now ?? defaultNow;
  const startedAt = now();
  const steps: SweepStepResult[] = [];
  const localStorageRef = resolveStorage(ctx.localStorage, 'localStorage');
  const sessionStorageRef = resolveStorage(ctx.sessionStorage, 'sessionStorage');

  try {
    steps.push(await timed(now, 'fcm.deleteToken', () => stepUnregisterFcm(ctx.fcm)));
    steps.push(await timed(now, 'queryClient.clear', () => stepClearQueryClient(ctx.queryClient)));
    steps.push(
      await timed(now, 'zustand.reset', () => {
        const { swept } = stepResetStores(ctx.stores);
        log.info('Zustand stores swept', { swept });
      }),
    );
    steps.push(
      await timed(now, 'localStorage.purge', () => {
        const { removed } = stepClearLocalStoragePrefixes(localStorageRef);
        log.info('localStorage prefixed keys purged', {
          removed,
          prefixes: CLEARED_LOCAL_STORAGE_PREFIXES,
        });
      }),
    );
    steps.push(
      await timed(now, 'sessionStorage.clear', () => stepClearSessionStorage(sessionStorageRef)),
    );
    steps.push(
      await timed(now, 'serviceWorker.unregister', () => stepUnregisterServiceWorkers(ctx)),
    );
  } finally {
    // CRITICAL: Firebase sign-out is the terminal step. It runs no matter
    // what earlier steps did, including synchronous throws. Wrap it in
    // `timed` so we still capture an `ok:false` entry on failure.
    steps.push(await timed(now, 'firebase.signOut', () => ctx.firebaseSignOut()));
  }

  const totalMs = Math.max(0, now() - startedAt);
  const terminal = steps[steps.length - 1];
  const signedOut = Boolean(terminal && terminal.step === 'firebase.signOut' && terminal.ok);
  const allOk = steps.every((s) => s.ok);

  const summary: SweepResult = { steps, totalMs, allOk, signedOut };

  // Single structured log line per sweep — QA can grep on the exact prefix.
  // eslint-disable-next-line no-console -- QA greps this exact `[auth] signOut sweep` prefix in browser devtools; logger.ts wraps/filters by level and would hide the structured payload. Swap when Sentry transport lands.
  console.info('[auth] signOut sweep', {
    totalMs: summary.totalMs,
    allOk: summary.allOk,
    signedOut: summary.signedOut,
    steps: summary.steps.map((s) => ({ step: s.step, ok: s.ok, ms: s.ms, err: s.err })),
  });

  return summary;
}
