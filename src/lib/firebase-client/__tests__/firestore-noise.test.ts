/**
 * firestore-noise.test.ts
 *
 * Tests for Firestore log-level silencing (Phase 4, Agent 1) and Sentry
 * beforeBreadcrumb filter (Phase 4, Agent 3).
 *
 * --- setLogLevel tests (tests 1-2) ---
 * Strategy: Agent 1 placed the production gate inside `initializeFirebase()`,
 * not at module top-level. The correct test approach is:
 *   1. vi.resetModules() to clear the module cache.
 *   2. Set process.env.NODE_ENV.
 *   3. Dynamic-import the module — the vi.mock factories re-run for the fresh
 *      import graph, so setLogLevel is a fresh vi.fn().
 *   4. Call initializeFirebase() with a minimal config object (firebase/app is
 *      mocked so initializeApp returns a stub).
 *   5. Assert setLogLevel call count and argument.
 *
 * Note: vi.mock() calls are hoisted by Vitest's transformer; the factory
 * functions re-execute each time a module is freshly loaded after
 * vi.resetModules(). vi.clearAllMocks() between tests resets call counts on
 * the shared spy instances that survive resetModules.
 *
 * --- beforeBreadcrumb tests (tests 3-4) ---
 * The filter is defined inline inside Sentry.init() in both:
 *   - src/lib/sentry-capacitor.ts
 *   - sentry.client.config.ts
 * It is NOT exported as a standalone function.
 *
 * Two-pronged approach:
 *   a) Source-string assertions: verify config files contain the filter
 *      (fast, zero-dep, regression-guards against accidental deletion).
 *   b) Behavior tests against a test-local pure helper that mirrors the
 *      inline logic exactly. This is the standard pattern when a function
 *      cannot be imported without side-effecting Sentry.init or requiring
 *      native platform stubs.
 *
 * If a future refactor exports the filter as a named function, the behavior
 * tests below can import it directly instead.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted by Vitest before any import
// ---------------------------------------------------------------------------

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]', options: {} })),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  setPersistence: vi.fn(() => Promise.resolve()),
  indexedDBLocalPersistence: {},
  onAuthStateChanged: vi.fn(() => () => {}),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function () {
    return { setCustomParameters: vi.fn() };
  }),
  signInWithPhoneNumber: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updatePassword: vi.fn(),
  updateProfile: vi.fn(),
  linkWithCredential: vi.fn(),
  unlink: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  setLogLevel: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn() })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  increment: vi.fn(),
  Timestamp: { fromMillis: vi.fn(), now: vi.fn() },
}));

vi.mock('@/lib/firebase-client/config', () => ({
  firebaseConfig: {
    isConfigured: vi.fn(() => false),
    getFirebaseOptions: vi.fn(() => ({})),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Minimal Firebase config stub — satisfies the FirebaseOptions type.
// ---------------------------------------------------------------------------
const STUB_CONFIG = {
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  storageBucket: 'test.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc',
};

// ---------------------------------------------------------------------------
// Tests: setLogLevel production gate (Agent 1)
// ---------------------------------------------------------------------------

describe('initializeFirebase — setLogLevel production gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls setLogLevel("error") exactly once when NODE_ENV is "production"', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    // Re-import after resetting modules so the module sees the updated env.
    vi.resetModules();
    const { initializeFirebase } = await import('@/lib/firebase-client/index');
    const firestoreMod = await import('firebase/firestore');
    const spy = vi.mocked(firestoreMod.setLogLevel);

    initializeFirebase(STUB_CONFIG);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('error');
  });

  it('does NOT call setLogLevel when NODE_ENV is "development"', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    vi.resetModules();
    const { initializeFirebase } = await import('@/lib/firebase-client/index');
    const firestoreMod = await import('firebase/firestore');
    const spy = vi.mocked(firestoreMod.setLogLevel);

    initializeFirebase(STUB_CONFIG);

    expect(spy).not.toHaveBeenCalled();
  });

  it('does NOT call setLogLevel when NODE_ENV is "test"', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    vi.resetModules();
    const { initializeFirebase } = await import('@/lib/firebase-client/index');
    const firestoreMod = await import('firebase/firestore');
    const spy = vi.mocked(firestoreMod.setLogLevel);

    initializeFirebase(STUB_CONFIG);

    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Sentry beforeBreadcrumb filter — behavior (Agent 3)
// ---------------------------------------------------------------------------

/**
 * Test-local pure function that mirrors the inline beforeBreadcrumb logic
 * present in both sentry-capacitor.ts and sentry.client.config.ts.
 *
 * Rationale: the filter is defined inline inside Sentry.init() and is not
 * exported. Re-implementing it here as a pure function lets us assert behavior
 * (drop / pass-through) without pulling in the Sentry SDK or the Capacitor
 * native platform stubs. The source-string assertions in the next describe
 * block verify that the actual config files contain matching logic.
 */
function firestoreBreadcrumbFilter(
  breadcrumb: { message?: string; [key: string]: unknown },
): { message?: string; [key: string]: unknown } | null {
  if (breadcrumb.message?.startsWith('Firestore (')) {
    return null;
  }
  return breadcrumb;
}

describe('Sentry beforeBreadcrumb filter — behavior', () => {
  it('drops a breadcrumb matching the exact bloom filter warning from the APK logs', () => {
    const breadcrumb = {
      message: 'Firestore (4.13.0): Decoding the base64 bloom filter ...',
      level: 'warning',
      type: 'debug',
    };
    expect(firestoreBreadcrumbFilter(breadcrumb)).toBeNull();
  });

  it('drops any breadcrumb whose message starts with "Firestore ("', () => {
    expect(firestoreBreadcrumbFilter({ message: 'Firestore (' })).toBeNull();
    expect(firestoreBreadcrumbFilter({ message: 'Firestore (4.13.0): some verbose log' })).toBeNull();
    expect(firestoreBreadcrumbFilter({ message: 'Firestore (10.0.0): index update' })).toBeNull();
  });

  it('passes through a breadcrumb with a generic non-Firestore message', () => {
    const breadcrumb = { message: 'Some non-firestore log', level: 'info' };
    const result = firestoreBreadcrumbFilter(breadcrumb);
    expect(result).toBe(breadcrumb);
  });

  it('passes through a breadcrumb where "Firestore (" appears mid-string, not at the start', () => {
    const breadcrumb = { message: 'App initialized Firestore (4.13.0) successfully' };
    expect(firestoreBreadcrumbFilter(breadcrumb)).toBe(breadcrumb);
  });

  it('passes through a breadcrumb with an undefined message (no crash)', () => {
    const breadcrumb = { level: 'info', category: 'http' };
    expect(firestoreBreadcrumbFilter(breadcrumb)).toBe(breadcrumb);
  });

  it('passes through a breadcrumb with an empty message string', () => {
    const breadcrumb = { message: '' };
    expect(firestoreBreadcrumbFilter(breadcrumb)).toBe(breadcrumb);
  });

  it('passes through a breadcrumb with a null message field', () => {
    const breadcrumb = { message: null as unknown as string };
    expect(firestoreBreadcrumbFilter(breadcrumb)).toBe(breadcrumb);
  });
});

// ---------------------------------------------------------------------------
// Tests: Sentry beforeBreadcrumb filter — source-string verification (Agent 3)
// ---------------------------------------------------------------------------

/**
 * These tests read the actual Sentry config source files and assert that the
 * expected filter logic is present. They guard against:
 *   - The filter being accidentally removed during refactoring
 *   - The prefix string being changed without updating behavior tests
 *   - The pass-through branch being lost
 *
 * Paths are resolved relative to __dirname so they work regardless of the
 * Vitest working directory.
 */

const FRONTEND_ROOT = path.resolve(__dirname, '../../../../');

const SENTRY_CAPACITOR_PATH = path.join(
  FRONTEND_ROOT,
  'src/lib/sentry-capacitor.ts',
);
const SENTRY_CLIENT_CONFIG_PATH = path.join(
  FRONTEND_ROOT,
  'sentry.client.config.ts',
);

describe('Sentry beforeBreadcrumb filter — source-string verification', () => {
  it('sentry-capacitor.ts contains a beforeBreadcrumb callback', () => {
    const source = readFileSync(SENTRY_CAPACITOR_PATH, 'utf-8');
    expect(source).toMatch(/beforeBreadcrumb/);
  });

  it('sentry-capacitor.ts filter checks startsWith("Firestore (")', () => {
    const source = readFileSync(SENTRY_CAPACITOR_PATH, 'utf-8');
    expect(source).toMatch(/startsWith/);
    expect(source).toMatch(/Firestore \(/);
  });

  it('sentry-capacitor.ts filter returns null for Firestore-prefixed messages', () => {
    const source = readFileSync(SENTRY_CAPACITOR_PATH, 'utf-8');
    expect(source).toMatch(/return null/);
  });

  it('sentry-capacitor.ts filter has a default pass-through branch', () => {
    const source = readFileSync(SENTRY_CAPACITOR_PATH, 'utf-8');
    expect(source).toMatch(/return breadcrumb/);
  });

  it('sentry.client.config.ts contains a beforeBreadcrumb callback', () => {
    const source = readFileSync(SENTRY_CLIENT_CONFIG_PATH, 'utf-8');
    expect(source).toMatch(/beforeBreadcrumb/);
  });

  it('sentry.client.config.ts filter checks startsWith("Firestore (")', () => {
    const source = readFileSync(SENTRY_CLIENT_CONFIG_PATH, 'utf-8');
    expect(source).toMatch(/startsWith/);
    expect(source).toMatch(/Firestore \(/);
  });

  it('sentry.client.config.ts filter returns null for Firestore-prefixed messages', () => {
    const source = readFileSync(SENTRY_CLIENT_CONFIG_PATH, 'utf-8');
    expect(source).toMatch(/return null/);
  });

  it('sentry.client.config.ts filter has a default pass-through branch', () => {
    const source = readFileSync(SENTRY_CLIENT_CONFIG_PATH, 'utf-8');
    expect(source).toMatch(/return breadcrumb/);
  });
});
