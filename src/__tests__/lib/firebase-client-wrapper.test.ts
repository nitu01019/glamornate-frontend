/**
 * Phase 8 / Patch H5 (Booking Flow Fix v3.1, 2026-05-02): regression tests
 * pinning `firebaseClientWrapper`'s read-path classification of App Check
 * denials. Three surfaces are covered: `getDocuments`, `subscribeToDocument`,
 * and `subscribeToQuery`. In every case, when the underlying Firestore op
 * fails with `permission-denied` AND `getAppCheckToken` returns null, the
 * wrapper must surface a typed `AppCheckError` (not a generic
 * `AppFirebaseError`) and emit a `firestore_read_error` Sentry breadcrumb.
 *
 * The error envelope drives the bookings list's typed-error UI (Patch H5)
 * — a misclassification here surfaces to the user as a generic empty
 * state and hides the operator-actionable App Check banner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// firebase/firestore mock — capture the onSnapshot error callback so we can
// drive the subscribe paths from the test.
// ---------------------------------------------------------------------------

const getDocsSpy = vi.fn<() => Promise<unknown>>();
const onSnapshotSpy = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ __ref: 'collection' })),
  doc: vi.fn(() => ({ __ref: 'doc' })),
  getDoc: vi.fn(),
  getDocs: () => getDocsSpy(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  onSnapshot: (
    _ref: unknown,
    _next: (snap: unknown) => void,
    errorCb: (err: unknown) => void,
  ) => {
    onSnapshotSpy(_ref, _next, errorCb);
    return () => {};
  },
  serverTimestamp: vi.fn(),
}));

// ---------------------------------------------------------------------------
// firebase mock — wrapper checks `isFirebaseConfigured()` and reaches for
// `getFirestoreDb()` before any op.
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: () => true,
  getFirestoreDb: () => ({ __mock: 'firestore' }),
  getFirebaseApp: () => ({ name: '[DEFAULT]' }),
}));

// ---------------------------------------------------------------------------
// app-check mock — return `null` to simulate the no-token state that
// triggers the App Check classification branch.
// ---------------------------------------------------------------------------

const getAppCheckTokenSpy = vi.fn<() => Promise<string | null>>();

vi.mock('@/lib/app-check', () => ({
  getAppCheckToken: () => getAppCheckTokenSpy(),
}));

// ---------------------------------------------------------------------------
// Sentry mock — assert the breadcrumb category.
// ---------------------------------------------------------------------------

const addBreadcrumbSpy = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbSpy(...args),
}));

// ---------------------------------------------------------------------------
// Logger mock — wrapper builds a child logger at construction time.
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// firebase/functions only used by `callFunction` — stub so import resolves.
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { firebaseClientWrapper } from '@/lib/firebase-client-wrapper';
import { AppCheckError } from '@/lib/error-handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class FakeFirestoreError extends Error {
  code: string;
  constructor(code: string, message = 'Missing or insufficient permissions.') {
    super(message);
    this.name = 'FirebaseError';
    this.code = code;
  }
}

beforeEach(() => {
  getDocsSpy.mockReset();
  onSnapshotSpy.mockReset();
  getAppCheckTokenSpy.mockReset();
  addBreadcrumbSpy.mockReset();
  // Default: no App Check token available — this is the boundary the
  // classifier uses to decide between AppCheckError and generic.
  getAppCheckTokenSpy.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('firebaseClientWrapper — App Check classification on read paths', () => {
  it('getDocuments throws AppCheckError on permission-denied + no token, with firestore_read_error breadcrumb', async () => {
    getDocsSpy.mockRejectedValueOnce(new FakeFirestoreError('permission-denied'));

    let captured: unknown;
    try {
      await firebaseClientWrapper.getDocuments('bookings', []);
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(AppCheckError);
    expect(addBreadcrumbSpy).toHaveBeenCalled();
    const breadcrumbArg = addBreadcrumbSpy.mock.calls[0][0] as { category: string };
    expect(breadcrumbArg.category).toBe('firestore_read_error');
  });

  it('subscribeToDocument surfaces AppCheckError via callback on permission-denied + no token', async () => {
    let capturedError: unknown;
    const callback = vi.fn((_data: unknown, err?: unknown) => {
      if (err) capturedError = err;
    });

    firebaseClientWrapper.subscribeToDocument('bookings', 'b1', callback);

    // Drive the onSnapshot error path with a permission-denied error.
    expect(onSnapshotSpy).toHaveBeenCalledTimes(1);
    const errorCb = onSnapshotSpy.mock.calls[0][2] as (err: unknown) => void;
    await errorCb(new FakeFirestoreError('permission-denied'));

    // Callback may receive the error asynchronously (classifier awaits the
    // app-check probe) — give the microtask queue a tick.
    await new Promise((r) => setTimeout(r, 0));

    expect(capturedError).toBeInstanceOf(AppCheckError);
    const lastCall = addBreadcrumbSpy.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    expect((lastCall![0] as { category: string }).category).toBe('firestore_read_error');
  });

  it('subscribeToQuery surfaces AppCheckError via callback on permission-denied + no token', async () => {
    let capturedError: unknown;
    const callback = vi.fn((_data: unknown[], err?: unknown) => {
      if (err) capturedError = err;
    });

    firebaseClientWrapper.subscribeToQuery('bookings', [], callback);

    expect(onSnapshotSpy).toHaveBeenCalledTimes(1);
    const errorCb = onSnapshotSpy.mock.calls[0][2] as (err: unknown) => void;
    await errorCb(new FakeFirestoreError('permission-denied'));
    await new Promise((r) => setTimeout(r, 0));

    expect(capturedError).toBeInstanceOf(AppCheckError);
    const lastCall = addBreadcrumbSpy.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    expect((lastCall![0] as { category: string }).category).toBe('firestore_read_error');
  });
});
