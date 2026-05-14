import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MutableRefObject } from 'react';
import { AuthError } from '@/lib/error-handler';

// ---------------------------------------------------------------------------
// Mocks (declared via factory so vi.mock hoisting still sees them).
// signInMock / createUserMock / sendPasswordResetEmailMock are exported from
// the mock so the tests can swap implementations per-case via mockImplementationOnce.
// ---------------------------------------------------------------------------

const signInMock = vi.fn();
const createUserMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();
const sendEmailVerificationMock = vi.fn();
const updateProfileMock = vi.fn();

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('firebase/auth');
  return {
    ...actual,
    signInWithEmailAndPassword: (...args: unknown[]) => signInMock(...args),
    createUserWithEmailAndPassword: (...args: unknown[]) => createUserMock(...args),
    sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
    sendEmailVerification: (...args: unknown[]) => sendEmailVerificationMock(...args),
    updateProfile: (...args: unknown[]) => updateProfileMock(...args),
  };
});

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseAuth: () => ({}),
}));

const sentryCaptureMock = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => sentryCaptureMock(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks so the module under test binds to the mocked SDK.
// ---------------------------------------------------------------------------

import { createEmailAuth, type EmailAuthDeps } from '../email';

function makeLog() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
}

function makeDeps(): EmailAuthDeps & { log: ReturnType<typeof makeLog> } {
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

// Build a Firebase-shaped error: { code, message }
function fbErr(code: string | undefined, message: string): Error & { code?: string } {
  const e = new Error(message) as Error & { code?: string };
  if (code !== undefined) e.code = code;
  return e;
}

beforeEach(() => {
  signInMock.mockReset();
  createUserMock.mockReset();
  sendPasswordResetEmailMock.mockReset();
  sendEmailVerificationMock.mockReset();
  updateProfileMock.mockReset();
  sentryCaptureMock.mockReset();
  // Default no-op resolution for the createUserWithEmailAndPassword "happy"
  // case helpers below — overridden per test where needed.
  sendEmailVerificationMock.mockResolvedValue(undefined);
  updateProfileMock.mockResolvedValue(undefined);
});

// ===========================================================================
// signIn — Hunt-D1 normalization parity with signUp
// ===========================================================================

describe('createEmailAuth.signIn — Hunt-D1 normalization (Track A)', () => {
  it('routes opaque native failure (no .code) to auth/internal-error with raw suffix', async () => {
    // SDK throws a plain Error (no .code) — e.g. native bridge misconfigured.
    signInMock.mockRejectedValueOnce(new Error('opaque native failure'));
    const deps = makeDeps();
    const { signIn } = createEmailAuth(deps);

    await expect(signIn('user@example.com', 'pw1234')).rejects.toMatchObject({
      firebaseCode: 'auth/internal-error',
    });

    // Re-run to inspect the actual thrown instance — the matcher above doesn't
    // give us the AuthError directly.
    signInMock.mockRejectedValueOnce(new Error('opaque native failure'));
    let caught: unknown;
    try {
      await signIn('user@example.com', 'pw1234');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    expect(err.firebaseCode).toBe('auth/internal-error');
    expect(err.message).toContain('[opaque native failure]');
  });

  it('truncates raw suffix to ≤100 chars when SDK throws a long message', async () => {
    const longMsg = 'x'.repeat(500);
    signInMock.mockRejectedValueOnce(new Error(longMsg));
    const deps = makeDeps();
    const { signIn } = createEmailAuth(deps);

    let caught: unknown;
    try {
      await signIn('u@e.com', 'pw1234');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    // Extract `[...]` segment — it must be ≤100 chars between the brackets.
    const m = err.message.match(/\[(.*)\]$/);
    expect(m).not.toBeNull();
    expect(m![1].length).toBeLessThanOrEqual(100);
  });

  it('preserves recognized code (auth/wrong-password) without raw suffix', async () => {
    signInMock.mockRejectedValueOnce(fbErr('auth/wrong-password', 'whatever raw'));
    const deps = makeDeps();
    const { signIn } = createEmailAuth(deps);

    let caught: unknown;
    try {
      await signIn('u@e.com', 'pw1234');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    expect(err.firebaseCode).toBe('auth/wrong-password');
    expect(err.message).toBe('Email or password is incorrect.');
    expect(err.message).not.toContain('[');
  });

  it('does NOT normalize cross-provider link branch when isLinkFlow=true', async () => {
    // The link-flow guard at email.ts:62 suppresses pendingCredential stashing
    // and falls through to the standard throw — which on a recognized code is
    // NOT normalized. Crucially, sessionStorage must NOT be touched.
    signInMock.mockRejectedValueOnce(
      fbErr('auth/account-exists-with-different-credential', 'cross-provider'),
    );
    const deps = makeDeps();
    const { signIn } = createEmailAuth(deps);
    sessionStorage.clear();

    let caught: unknown;
    try {
      await signIn('u@e.com', 'pw1234', { isLinkFlow: true });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    expect(err.firebaseCode).toBe('auth/account-exists-with-different-credential');
    expect(sessionStorage.getItem('glamornate.pendingCredential')).toBeNull();
  });
});

// ===========================================================================
// resetPassword — Hunt-D1 normalization + user-not-found enumeration defence
// ===========================================================================

describe('createEmailAuth.resetPassword — Track A normalization', () => {
  it('routes unknown-code (no .code) to auth/internal-error with raw suffix', async () => {
    sendPasswordResetEmailMock.mockRejectedValueOnce(new Error('reset opaque'));
    const deps = makeDeps();
    const { resetPassword } = createEmailAuth(deps);

    let caught: unknown;
    try {
      await resetPassword('u@e.com');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    expect(err.firebaseCode).toBe('auth/internal-error');
    expect(err.message).toContain('[reset opaque]');
  });

  it('resolves silently on auth/user-not-found (enumeration-defence regression guard)', async () => {
    sendPasswordResetEmailMock.mockRejectedValueOnce(fbErr('auth/user-not-found', 'no user'));
    const deps = makeDeps();
    const { resetPassword } = createEmailAuth(deps);

    // Must NOT throw — returns undefined.
    await expect(resetPassword('u@e.com')).resolves.toBeUndefined();
    // And must NOT have shipped to Sentry — silent enumeration defence.
    expect(sentryCaptureMock).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// signUp — Hunt-D1 invariant regression guard (already correct in source)
// ===========================================================================

describe('createEmailAuth.signUp — Hunt-D1 invariant regression guard', () => {
  it('routes unknown-code through auth/internal-error with raw suffix', async () => {
    createUserMock.mockRejectedValueOnce(new Error('signup opaque'));
    const deps = makeDeps();
    const { signUp } = createEmailAuth(deps);

    let caught: unknown;
    try {
      await signUp('u@e.com', 'pw1234', 'Test User');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    expect(err.firebaseCode).toBe('auth/internal-error');
    expect(err.message).toContain('[signup opaque]');
  });
});
