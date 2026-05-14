import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MutableRefObject } from 'react';
import { AuthError } from '@/lib/error-handler';

// ---------------------------------------------------------------------------
// Mocks. Preserve real GoogleAuthProvider class via importActual spread so
// `new GoogleAuthProvider()` and `.setCustomParameters` still work inside
// the SUT. Web SDK call sites we substitute: signInWithPopup,
// signInWithRedirect, signInWithCredential, getRedirectResult.
// ---------------------------------------------------------------------------

const signInWithPopupMock = vi.fn();
const signInWithRedirectMock = vi.fn();
const signInWithCredentialMock = vi.fn();
const getRedirectResultMock = vi.fn();

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('firebase/auth');
  return {
    ...actual,
    signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
    signInWithRedirect: (...args: unknown[]) => signInWithRedirectMock(...args),
    signInWithCredential: (...args: unknown[]) => signInWithCredentialMock(...args),
    getRedirectResult: (...args: unknown[]) => getRedirectResultMock(...args),
  };
});

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseAuth: () => ({}),
}));

const sentryCaptureMock = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => sentryCaptureMock(...args),
}));

// Force the WEB branch: isNativePlatform → false. signInWithNativeGoogle is
// not exercised in these tests but must be importable.
const signInWithNativeGoogleMock = vi.fn();
vi.mock('../credential', () => ({
  isNativePlatform: () => false,
  signInWithNativeGoogle: (...args: unknown[]) => signInWithNativeGoogleMock(...args),
}));

// ---------------------------------------------------------------------------
// Import the SUT after mocks are installed.
// ---------------------------------------------------------------------------

import { createGoogleAuth, type GoogleAuthDeps } from '../google';

function makeLog() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
}

function makeDeps(): GoogleAuthDeps & { log: ReturnType<typeof makeLog> } {
  const log = makeLog();
  const profileCreationInFlightRef: MutableRefObject<Promise<void> | null> = {
    current: null,
  };
  return {
    fetchUserProfile: vi.fn().mockResolvedValue(null),
    createUserProfile: vi.fn().mockResolvedValue({}),
    profileCreationInFlightRef,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log: log as any,
  };
}

function fbErr(code: string | undefined, message: string): Error & { code?: string } {
  const e = new Error(message) as Error & { code?: string };
  if (code !== undefined) e.code = code;
  return e;
}

beforeEach(() => {
  signInWithPopupMock.mockReset();
  signInWithRedirectMock.mockReset();
  signInWithCredentialMock.mockReset();
  getRedirectResultMock.mockReset();
  signInWithNativeGoogleMock.mockReset();
  sentryCaptureMock.mockReset();
});

// ===========================================================================
// Web popup — Track A normalization
// ===========================================================================

describe('createGoogleAuth.signInWithGoogle — web popup Track A normalization', () => {
  it('routes opaque popup failure (no .code) to auth/internal-error with raw suffix', async () => {
    signInWithPopupMock.mockRejectedValueOnce(new Error('popup opaque failure'));
    const deps = makeDeps();
    const { signInWithGoogle } = createGoogleAuth(deps);

    let caught: unknown;
    try {
      await signInWithGoogle();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    expect(err.firebaseCode).toBe('auth/internal-error');
    expect(err.message).toContain('[popup opaque failure]');
  });

  it('truncates raw suffix to ≤100 chars on long opaque message', async () => {
    const longMsg = 'y'.repeat(500);
    signInWithPopupMock.mockRejectedValueOnce(new Error(longMsg));
    const deps = makeDeps();
    const { signInWithGoogle } = createGoogleAuth(deps);

    let caught: unknown;
    try {
      await signInWithGoogle();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    const m = err.message.match(/\[(.*)\]$/);
    expect(m).not.toBeNull();
    expect(m![1].length).toBeLessThanOrEqual(100);
  });

  it('preserves recognized code (auth/popup-closed-by-user) without raw suffix', async () => {
    signInWithPopupMock.mockRejectedValueOnce(
      fbErr('auth/popup-closed-by-user', 'user dismissed popup'),
    );
    const deps = makeDeps();
    const { signInWithGoogle } = createGoogleAuth(deps);

    let caught: unknown;
    try {
      await signInWithGoogle();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    expect(err.firebaseCode).toBe('auth/popup-closed-by-user');
    expect(err.message).toBe('Sign-in was cancelled.');
    expect(err.message).not.toContain('[');
  });
});
