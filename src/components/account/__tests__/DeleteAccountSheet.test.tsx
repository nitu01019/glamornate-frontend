/**
 * Tests for DeleteAccountSheet.
 *
 * Strategy:
 *   - Mock `firebase/functions` to intercept the `deleteAccount` callable.
 *   - Mock `firebase/auth` to intercept `reauthenticateWithCredential`.
 *   - Mock `@/lib/auth-provider` to expose a fake user + signOut spy.
 *   - Mock `next/navigation` to capture `router.push`.
 *   - Assert the multi-step flow matches the success contract:
 *       • confirmation input must be EXACTLY "DELETE MY ACCOUNT".
 *       • sheet cannot advance past step 1 until the user acknowledges AND
 *         types the phrase.
 *       • on success, signOut is called then router.push to
 *         `/auth/login?accountDeleted=1`.
 *       • requires-recent-login reopens step 2.
 *       • invalid-argument reopens step 1.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Firebase Auth mocks
// ---------------------------------------------------------------------------

const reauthenticateWithCredentialMock = vi.fn();
const emailAuthCredentialMock = vi.fn((email: string, password: string) => ({
  _email: email,
  _password: password,
}));

vi.mock('firebase/auth', () => ({
  reauthenticateWithCredential: (...args: unknown[]) =>
    reauthenticateWithCredentialMock(...args),
  EmailAuthProvider: {
    credential: (...args: unknown[]) => emailAuthCredentialMock(...(args as [string, string])),
  },
}));

// ---------------------------------------------------------------------------
// Firebase Functions mock — capture the httpsCallable invocation
// ---------------------------------------------------------------------------

const callableMock = vi.fn();
const httpsCallableMock = vi.fn(() => callableMock);
const getFunctionsMock = vi.fn(() => ({ _fake: 'functions' }));

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => httpsCallableMock(...(args as [])),
  getFunctions: (...args: unknown[]) => getFunctionsMock(...(args as [])),
}));

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseApp: () => ({ _fake: 'app' }),
}));

// ---------------------------------------------------------------------------
// Auth provider + router mocks
// ---------------------------------------------------------------------------

const getIdTokenMock = vi.fn().mockResolvedValue('id-token');
const fakeFirebaseUser = {
  uid: 'uid-1',
  email: 'user@example.com',
  getIdToken: getIdTokenMock,
};
const signOutMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    user: null,
    firebaseUser: fakeFirebaseUser,
    signOut: signOutMock,
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const routerPushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn(), back: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Toast mock
// ---------------------------------------------------------------------------

const toastCalls = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('@/lib/providers', () => ({
  useToastActions: () => toastCalls,
}));

// ---------------------------------------------------------------------------
// Logger mock
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import {
  DeleteAccountSheet,
  DELETE_CONFIRMATION_PHRASE,
} from '../DeleteAccountSheet';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  const onClose = vi.fn();
  const result = render(<DeleteAccountSheet open onClose={onClose} />);
  return { onClose, ...result };
}

function setConfirmInput(value: string) {
  const confirmInput = document.getElementById('dlt-confirm') as HTMLInputElement;
  fireEvent.change(confirmInput, { target: { value } });
}

function setPasswordInput(value: string) {
  const pwd = document.getElementById('dlt-pwd') as HTMLInputElement;
  fireEvent.change(pwd, { target: { value } });
}

async function advanceToReauth() {
  // Acknowledge
  const ack = screen.getByRole('checkbox');
  fireEvent.click(ack);
  // Type confirmation
  setConfirmInput(DELETE_CONFIRMATION_PHRASE);
  // Click continue
  const continueBtn = screen.getByRole('button', { name: /continue/i });
  expect(continueBtn).not.toBeDisabled();
  await act(async () => {
    fireEvent.click(continueBtn);
  });
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('DeleteAccountSheet', () => {
  beforeEach(() => {
    reauthenticateWithCredentialMock.mockReset();
    callableMock.mockReset();
    httpsCallableMock.mockClear();
    getFunctionsMock.mockClear();
    emailAuthCredentialMock.mockClear();
    signOutMock.mockClear();
    routerPushMock.mockClear();
    toastCalls.success.mockClear();
    toastCalls.error.mockClear();
    toastCalls.warning.mockClear();
    toastCalls.info.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the explanation step by default', () => {
    setup();
    expect(screen.getByText(/delete your account/i)).toBeInTheDocument();
    expect(screen.getByText(/what will be deleted/i)).toBeInTheDocument();
  });

  it('disables Continue until both acknowledge AND exact phrase are provided', () => {
    setup();
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    expect(continueBtn).toBeDisabled();

    const ack = screen.getByRole('checkbox');
    fireEvent.click(ack);
    expect(continueBtn).toBeDisabled();

    // Wrong phrase (lowercase) — keep disabled
    setConfirmInput('delete my account');
    expect(continueBtn).toBeDisabled();

    // Exact phrase — now enabled
    setConfirmInput(DELETE_CONFIRMATION_PHRASE);
    expect(continueBtn).not.toBeDisabled();
  });

  it('advances to the re-auth step when confirmation matches', async () => {
    setup();
    await advanceToReauth();
    await waitFor(() => {
      expect(screen.getByText(/confirm your password/i)).toBeInTheDocument();
      expect(document.getElementById('dlt-pwd')).not.toBeNull();
    });
  });

  it('completes the happy path: reauth → callable → signOut → router.push', async () => {
    reauthenticateWithCredentialMock.mockResolvedValue(undefined);
    callableMock.mockResolvedValue({ data: { success: true } });

    setup();
    await advanceToReauth();

    setPasswordInput('MyPassword1!');
    const submit = screen.getByRole('button', {
      name: /permanently delete my account/i,
    });
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(reauthenticateWithCredentialMock).toHaveBeenCalledTimes(1);
      expect(httpsCallableMock).toHaveBeenCalledWith(
        expect.anything(),
        'deleteAccount',
      );
      expect(callableMock).toHaveBeenCalledWith({
        confirmationString: DELETE_CONFIRMATION_PHRASE,
      });
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(routerPushMock).toHaveBeenCalledWith('/auth/login?accountDeleted=1');
      expect(toastCalls.success).toHaveBeenCalledTimes(1);
    });
  });

  it('reopens the re-auth step when callable returns requires-recent-login', async () => {
    reauthenticateWithCredentialMock.mockResolvedValue(undefined);
    const staleErr = Object.assign(new Error('stale'), {
      code: 'failed-precondition',
      details: { code: 'account/requires-recent-login' },
      message: 'account/requires-recent-login',
    });
    callableMock.mockRejectedValue(staleErr);

    setup();
    await advanceToReauth();
    setPasswordInput('MyPassword1!');
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /permanently delete my account/i }),
      );
    });

    await waitFor(() => {
      expect(toastCalls.error).toHaveBeenCalledTimes(1);
      expect(signOutMock).not.toHaveBeenCalled();
      expect(routerPushMock).not.toHaveBeenCalled();
      // Still on re-auth step; password cleared for retry.
      expect(screen.getByText(/confirm your password/i)).toBeInTheDocument();
      const pwd = document.getElementById('dlt-pwd') as HTMLInputElement;
      expect(pwd.value).toBe('');
    });
  });

  it('returns to step 1 on invalid-argument (confirmation mismatch on server)', async () => {
    reauthenticateWithCredentialMock.mockResolvedValue(undefined);
    const invalidErr = Object.assign(new Error('invalid'), {
      code: 'invalid-argument',
      details: { code: 'account/invalid-confirmation' },
      message: 'account/invalid-confirmation',
    });
    callableMock.mockRejectedValue(invalidErr);

    setup();
    await advanceToReauth();
    setPasswordInput('MyPassword1!');
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /permanently delete my account/i }),
      );
    });

    await waitFor(() => {
      expect(toastCalls.error).toHaveBeenCalledTimes(1);
      // Back to step 1; phrase cleared.
      expect(screen.getByText(/what will be deleted/i)).toBeInTheDocument();
      const confirmInput = document.getElementById('dlt-confirm') as HTMLInputElement;
      expect(confirmInput.value).toBe('');
    });
  });

  it('surfaces auth/wrong-password from reauthenticate without calling the callable', async () => {
    const wrongPwErr = Object.assign(new Error('wrong'), { code: 'auth/wrong-password' });
    reauthenticateWithCredentialMock.mockRejectedValue(wrongPwErr);

    setup();
    await advanceToReauth();
    setPasswordInput('BadPassword1!');
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /permanently delete my account/i }),
      );
    });

    await waitFor(() => {
      expect(toastCalls.error).toHaveBeenCalledTimes(1);
      const [title] = toastCalls.error.mock.calls[0] as [string, string];
      expect(title).toMatch(/incorrect current password/i);
      expect(callableMock).not.toHaveBeenCalled();
      expect(signOutMock).not.toHaveBeenCalled();
    });
  });

  it('still redirects when signOut sweep throws (server already deleted)', async () => {
    reauthenticateWithCredentialMock.mockResolvedValue(undefined);
    callableMock.mockResolvedValue({ data: { success: true } });
    signOutMock.mockRejectedValueOnce(new Error('sweep boom'));

    setup();
    await advanceToReauth();
    setPasswordInput('MyPassword1!');
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /permanently delete my account/i }),
      );
    });

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith('/auth/login?accountDeleted=1');
    });
  });
});
