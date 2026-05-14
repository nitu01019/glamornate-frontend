import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLEARED_LOCAL_STORAGE_PREFIXES,
  sweepClientState,
  type FcmHandle,
  type StoreHandle,
} from '@/auth/sign-out-sweeper';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function makeStorage(initial: Record<string, string> = {}): Storage {
  const store: Record<string, string> = { ...initial };
  const storage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
  return storage;
}

function makeQueryClient() {
  const state = { hasData: true };
  const cancelQueries = vi.fn().mockResolvedValue(undefined);
  const clear = vi.fn(() => {
    state.hasData = false;
  });
  return { state, cancelQueries, clear };
}

function makeStore(
  name: string,
  handlers: Partial<Record<string, ReturnType<typeof vi.fn>>>,
): StoreHandle {
  return {
    name,
    getState: () => handlers as Record<string, unknown>,
  };
}

function makeFcm(overrides: Partial<FcmHandle> = {}): FcmHandle {
  return {
    messaging: { sentinel: true },
    getTokenSafely: vi.fn().mockResolvedValue('tok-123'),
    deleteToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Monotonic clock the tests can advance explicitly.
function makeClock() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('sweepClientState', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it('executes every step in the documented order', async () => {
    const firebaseSignOut = vi.fn().mockResolvedValue(undefined);
    const queryClient = makeQueryClient();
    const clearCart = vi.fn();
    const result = await sweepClientState({
      queryClient,
      stores: [makeStore('cart', { clearCart })],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut,
    });

    expect(result.steps.map((s) => s.step)).toEqual([
      'fcm.deleteToken',
      'queryClient.clear',
      'zustand.reset',
      'localStorage.purge',
      'sessionStorage.clear',
      'serviceWorker.unregister',
      // firestore.idbClear removed 2026-05-14 — terminated client broke next sign-in
      'capacitor.prefsClear',
      'firebase.signOut',
    ]);
    expect(result.signedOut).toBe(true);
    expect(result.allOk).toBe(true);
  });

  it('emits a single structured console.info summary per sweep', async () => {
    await sweepClientState({
      queryClient: makeQueryClient(),
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    const [label, summary] = consoleInfoSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(label).toBe('[auth] signOut sweep');
    expect(summary).toEqual(
      expect.objectContaining({
        allOk: true,
        signedOut: true,
        steps: expect.any(Array),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // React Query
  // -------------------------------------------------------------------------

  it('cancels queries then clears the React Query cache', async () => {
    const queryClient = makeQueryClient();
    await sweepClientState({
      queryClient,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });

    expect(queryClient.cancelQueries).toHaveBeenCalledTimes(1);
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(queryClient.state.hasData).toBe(false);
  });

  it('tolerates a missing QueryClient (idempotent sign-out after session died)', async () => {
    const result = await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });
    const qc = result.steps.find((s) => s.step === 'queryClient.clear')!;
    expect(qc.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Zustand
  // -------------------------------------------------------------------------

  it('calls reset / clearCart / disconnect on every store that has one', async () => {
    const resetBooking = vi.fn();
    const clearCart = vi.fn();
    const disconnectChat = vi.fn();

    await sweepClientState({
      queryClient: null,
      stores: [
        makeStore('cart', { clearCart }),
        makeStore('chat', { disconnect: disconnectChat }),
        makeStore('booking', { reset: resetBooking }),
      ],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });

    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(disconnectChat).toHaveBeenCalledTimes(1);
    expect(resetBooking).toHaveBeenCalledTimes(1);
  });

  it('prefers the first matching method from the provided order', async () => {
    const reset = vi.fn();
    const clear = vi.fn();
    await sweepClientState({
      queryClient: null,
      stores: [
        {
          name: 'custom',
          getState: () => ({ reset, clear }),
          methods: ['clear', 'reset'], // clear wins over reset by explicit order
        },
      ],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it('skips stores whose getState throws without breaking the sweep', async () => {
    const goodClear = vi.fn();
    const result = await sweepClientState({
      queryClient: null,
      stores: [
        {
          name: 'broken',
          getState: () => {
            throw new Error('provider torn down');
          },
        },
        makeStore('cart', { clearCart: goodClear }),
      ],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });
    expect(goodClear).toHaveBeenCalledTimes(1);
    expect(result.allOk).toBe(true);
  });

  // -------------------------------------------------------------------------
  // localStorage
  // -------------------------------------------------------------------------

  it('removes only keys matching the allowlisted prefixes', async () => {
    const ls = makeStorage({
      'glamornate-cart': 'x',
      glamornate_user_location: 'x',
      'glm:feature-flags': 'x',
      'cart:v2:draft': 'x',
      'location:recent': 'x',
      'rq-persist-glamornate': 'x',
      'analytics-session-id': 'untouched',
      'user-theme': 'untouched',
    });
    const spy = vi.spyOn(ls, 'removeItem');
    await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: ls,
      sessionStorage: makeStorage(),
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });

    const removed = spy.mock.calls.map(([k]) => k).sort();
    expect(removed).toEqual(
      [
        'glamornate-cart',
        'glamornate_user_location',
        'glm:feature-flags',
        'cart:v2:draft',
        'location:recent',
        'rq-persist-glamornate',
      ].sort(),
    );
    expect(ls.getItem('analytics-session-id')).toBe('untouched');
    expect(ls.getItem('user-theme')).toBe('untouched');
  });

  it('documents every allowlisted prefix in the exported constant', () => {
    // Guardrail: every entry must be non-empty and delimited so a literal
    // unrelated key can never accidentally start with a prefix like "a".
    for (const prefix of CLEARED_LOCAL_STORAGE_PREFIXES) {
      expect(prefix.length).toBeGreaterThan(1);
    }
    expect(CLEARED_LOCAL_STORAGE_PREFIXES).toEqual(
      expect.arrayContaining([
        'glamornate-',
        'glamornate_',
        'glm:',
        'location:',
        'cart:',
        'rq-persist-',
      ]),
    );
  });

  // -------------------------------------------------------------------------
  // sessionStorage
  // -------------------------------------------------------------------------

  it('clears sessionStorage fully', async () => {
    const ss = makeStorage({ 'glamornate-popup-seen': 'true', anything: '1' });
    await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: ss,
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });
    expect(ss.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // FCM
  // -------------------------------------------------------------------------

  it('FCM happy path calls deleteToken(messaging)', async () => {
    const fcm = makeFcm();
    await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      fcm,
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });
    expect(fcm.deleteToken).toHaveBeenCalledWith(fcm.messaging);
  });

  it('FCM skips deleteToken when no token is registered', async () => {
    const deleteToken = vi.fn();
    const fcm = makeFcm({
      getTokenSafely: vi.fn().mockResolvedValue(null),
      deleteToken,
    });
    await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      fcm,
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });
    expect(deleteToken).not.toHaveBeenCalled();
  });

  it('FCM deleteToken failure is captured but does not abort the sweep', async () => {
    const firebaseSignOut = vi.fn().mockResolvedValue(undefined);
    const fcm = makeFcm({
      deleteToken: vi.fn().mockRejectedValue(new Error('messaging offline')),
    });
    const result = await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      fcm,
      firebaseSignOut,
    });
    const fcmStep = result.steps.find((s) => s.step === 'fcm.deleteToken')!;
    expect(fcmStep.ok).toBe(false);
    expect(fcmStep.err).toBe('messaging offline');
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
    expect(result.signedOut).toBe(true);
    expect(result.allOk).toBe(false);
  });

  it('FCM no-ops gracefully when messaging is absent', async () => {
    const result = await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      // No fcm key passed
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });
    const fcmStep = result.steps.find((s) => s.step === 'fcm.deleteToken')!;
    expect(fcmStep.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Service Worker / cache
  // -------------------------------------------------------------------------

  it('clears every cache and unregisters every service worker', async () => {
    const deletedKeys: string[] = [];
    const caches: CacheStorage = {
      keys: vi.fn().mockResolvedValue(['glamornate-runtime', 'glamornate-static']),
      delete: vi.fn(async (key: string) => {
        deletedKeys.push(key);
        return true;
      }),
      match: vi.fn(),
      has: vi.fn(),
      open: vi.fn(),
    } as unknown as CacheStorage;

    const unregister1 = vi.fn().mockResolvedValue(true);
    const unregister2 = vi.fn().mockResolvedValue(true);

    await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      caches,
      getServiceWorkerRegistrations: async () => [
        { unregister: unregister1 },
        { unregister: unregister2 },
      ],
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });

    expect(deletedKeys.sort()).toEqual(['glamornate-runtime', 'glamornate-static'].sort());
    expect(unregister1).toHaveBeenCalled();
    expect(unregister2).toHaveBeenCalled();
  });

  it('tolerates caches.delete throwing and still signs out', async () => {
    const caches: CacheStorage = {
      keys: vi.fn().mockResolvedValue(['a', 'b']),
      delete: vi.fn().mockRejectedValue(new Error('boom')),
      match: vi.fn(),
      has: vi.fn(),
      open: vi.fn(),
    } as unknown as CacheStorage;
    const firebaseSignOut = vi.fn().mockResolvedValue(undefined);
    const result = await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      caches,
      getServiceWorkerRegistrations: async () => [],
      firebaseSignOut,
    });
    // The sweeper logs cache.delete failures but does not mark the whole
    // step as failed because each individual delete is independent.
    const swStep = result.steps.find((s) => s.step === 'serviceWorker.unregister')!;
    expect(swStep.ok).toBe(true);
    expect(firebaseSignOut).toHaveBeenCalled();
  });

  it('no-ops when caches + serviceWorker are unavailable', async () => {
    const result = await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      getServiceWorkerRegistrations: async () => [],
      firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    });
    const swStep = result.steps.find((s) => s.step === 'serviceWorker.unregister')!;
    expect(swStep.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Terminal signOut + resilience
  // -------------------------------------------------------------------------

  it('runs firebase.signOut even when earlier steps throw', async () => {
    const firebaseSignOut = vi.fn().mockResolvedValue(undefined);
    const queryClient = {
      cancelQueries: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(() => {
        throw new Error('clear failed');
      }),
    };
    const result = await sweepClientState({
      queryClient,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut,
    });
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
    expect(result.signedOut).toBe(true);
    const qcStep = result.steps.find((s) => s.step === 'queryClient.clear')!;
    expect(qcStep.ok).toBe(false);
    expect(qcStep.err).toBe('clear failed');
  });

  it('returns signedOut:false when firebase.signOut itself throws', async () => {
    const firebaseSignOut = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut,
    });
    expect(result.signedOut).toBe(false);
    expect(result.allOk).toBe(false);
    const fb = result.steps.find((s) => s.step === 'firebase.signOut')!;
    expect(fb.ok).toBe(false);
    expect(fb.err).toBe('network down');
  });

  it('idempotent: running twice leaves storage empty and calls signOut twice', async () => {
    const ls = makeStorage({ 'glamornate-cart': 'x' });
    const ss = makeStorage({ 'glamornate-popup-seen': 'true' });
    const firebaseSignOut = vi.fn().mockResolvedValue(undefined);

    await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: ls,
      sessionStorage: ss,
      firebaseSignOut,
    });
    await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: ls,
      sessionStorage: ss,
      firebaseSignOut,
    });

    expect(ls.length).toBe(0);
    expect(ss.length).toBe(0);
    expect(firebaseSignOut).toHaveBeenCalledTimes(2);
  });

  it('records monotonic ms readings using the injected clock', async () => {
    const clock = makeClock();
    const firebaseSignOut = vi.fn(async () => {
      clock.advance(12);
    });
    const result = await sweepClientState({
      queryClient: null,
      stores: [],
      localStorage: makeStorage(),
      sessionStorage: makeStorage(),
      firebaseSignOut,
      now: clock.now,
    });
    const fb = result.steps.find((s) => s.step === 'firebase.signOut')!;
    expect(fb.ms).toBe(12);
    expect(result.totalMs).toBeGreaterThanOrEqual(12);
  });
});
