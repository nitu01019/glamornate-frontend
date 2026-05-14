/**
 * Tests for ChangePasswordSheet.
 *
 * Strategy:
 *   - Mock `firebase/auth` so we can simulate reauthenticate + updatePassword
 *     success/failure deterministically.
 *   - Mock `@/lib/auth-provider` so useAuth returns a stable fake user.
 *   - Mock `@/lib/providers` (useToastActions) to capture toast calls.
 *   - Assert flows documented in the success contract:
 *       (a) happy path → success toast + onClose
 *       (b) wrong current password → "Incorrect current password" copy
 *       (c) weak new password → strength meter blocks submit client-side
 *       (d) requires-recent-login → re-prompts for current password
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Firebase Auth mocks
// ---------------------------------------------------------------------------

const reauthenticateWithCredentialMock = vi.fn();
const updatePasswordMock = vi.fn();
const emailAuthCredentialMock = vi.fn((email: string, password: string) => ({
  _email: email,
  _password: password,
}));

vi.mock('firebase/auth', () => ({
  reauthenticateWithCredential: (...args: unknown[]) => reauthenticateWithCredentialMock(...args),
  updatePassword: (...args: unknown[]) => updatePasswordMock(...args),
  EmailAuthProvider: {
    credential: (...args: unknown[]) => emailAuthCredentialMock(...(args as [string, string])),
  },
  // Stubs to satisfy transitive imports from `@/lib/firebase-client` —
  // added 2026-05-11 when ChangePasswordSheet started importing
  // getFirebaseApp (for the revokeMySessions callable wire-up, T3-F5).
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  indexedDBLocalPersistence: {},
  browserLocalPersistence: {},
  inMemoryPersistence: {},
}));

// 2026-05-11 (T3-F5): mock the revokeMySessions callable + firebase-client
// so the component's password-change flow can call it without booting the
// real Firebase app in tests.
const revokeMySessionsMock = vi.fn().mockResolvedValue({ data: { success: true } });
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => revokeMySessionsMock),
}));
vi.mock('@/lib/firebase-client', () => ({
  getFirebaseApp: vi.fn(() => ({})),
  getFirebaseAuth: vi.fn(() => ({})),
  getFirebaseFirestore: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Auth provider mock
// ---------------------------------------------------------------------------

const getIdTokenMock = vi.fn().mockResolvedValue('id-token');
const fakeFirebaseUser = {
  uid: 'uid-1',
  email: 'user@example.com',
  getIdToken: getIdTokenMock,
};

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    user: null,
    firebaseUser: fakeFirebaseUser,
    signOut: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
  }),
}));

// ---------------------------------------------------------------------------
// Toast actions mock
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
// Logger mock — suppress stderr noise
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

import { ChangePasswordSheet, scorePassword } from '../ChangePasswordSheet';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  const onClose = vi.fn();
  const result = render(<ChangePasswordSheet open onClose={onClose} />);
  return { onClose, ...result };
}

function fillPasswords(current: string, next: string, confirm: string) {
  const currentInput = document.getElementById('cps-current') as HTMLInputElement;
  const newInput = document.getElementById('cps-new') as HTMLInputElement;
  const confirmInput = document.getElementById('cps-confirm') as HTMLInputElement;
  // `react-hook-form` subscribes via `useWatch`, which requires React to
  // flush the subscriber re-render before the `canSubmit` gate reflects
  // the new values. Wrap all three changes in `act` so the subscriber
  // effect runs synchronously inside the test.
  act(() => {
    fireEvent.change(currentInput, { target: { value: current } });
    fireEvent.change(newInput, { target: { value: next } });
    fireEvent.change(confirmInput, { target: { value: confirm } });
  });
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('scorePassword', () => {
  it('returns score 0 for empty input', () => {
    const s = scorePassword('');
    expect(s.score).toBe(0);
    expect(s.meetsMinimum).toBe(false);
  });

  it('returns a higher score when mixed character classes are present', () => {
    const weak = scorePassword('aaaaaaaa');
    const strong = scorePassword('Aa1!bcDe');
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.meetsMinimum).toBe(true);
  });

  it('requires length >= 8 to meet the minimum', () => {
    expect(scorePassword('Aa1!bcD').meetsMinimum).toBe(false);
    expect(scorePassword('Aa1!bcDe').meetsMinimum).toBe(true);
  });
});

describe('ChangePasswordSheet', () => {
  beforeEach(() => {
    reauthenticateWithCredentialMock.mockReset();
    updatePasswordMock.mockReset();
    emailAuthCredentialMock.mockClear();
    toastCalls.success.mockClear();
    toastCalls.error.mockClear();
    toastCalls.warning.mockClear();
    toastCalls.info.mockClear();
    getIdTokenMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the three password fields and title when open', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument();
    expect(document.getElementById('cps-current')).not.toBeNull();
    expect(document.getElementById('cps-new')).not.toBeNull();
    expect(document.getElementById('cps-confirm')).not.toBeNull();
  });

  it('disables submit while the strength rules are not met', () => {
    setup();
    fillPasswords('current1!', 'short', 'short');
    const submit = screen.getByRole('button', { name: /update password/i });
    expect(submit).toBeDisabled();
    // Strong new password but confirm is mismatched keeps it disabled.
    const newInput = document.getElementById('cps-new') as HTMLInputElement;
    fireEvent.change(newInput, { target: { value: 'StrongP@ss1' } });
    expect(submit).toBeDisabled();
  });

  it('calls reauthenticateWithCredential + updatePassword on happy path', async () => {
    reauthenticateWithCredentialMock.mockResolvedValue(undefined);
    updatePasswordMock.mockResolvedValue(undefined);
    const { onClose } = setup();
    fillPasswords('Current1!', 'StrongP@ss1', 'StrongP@ss1');

    const submit = screen.getByRole('button', { name: /update password/i });
    expect(submit).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(reauthenticateWithCredentialMock).toHaveBeenCalledTimes(1);
      expect(updatePasswordMock).toHaveBeenCalledWith(fakeFirebaseUser, 'StrongP@ss1');
      expect(toastCalls.success).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('maps auth/wrong-password to the current-password field error', async () => {
    const wrongPwErr = Object.assign(new Error('wrong'), { code: 'auth/wrong-password' });
    reauthenticateWithCredentialMock.mockRejectedValue(wrongPwErr);

    setup();
    fillPasswords('Wrong1P!', 'StrongP@ss1', 'StrongP@ss1');

    const submit = screen.getByRole('button', { name: /update password/i });
    expect(submit).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(toastCalls.error).toHaveBeenCalledTimes(1);
      const [title, body] = toastCalls.error.mock.calls[0] as [string, string];
      expect(title).toMatch(/incorrect current password/i);
      expect(body).not.toMatch(/FirebaseError/i);
    });
    // updatePassword should never be reached.
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it('re-prompts for current password on auth/requires-recent-login', async () => {
    const recentErr = Object.assign(new Error('recent'), {
      code: 'auth/requires-recent-login',
    });
    reauthenticateWithCredentialMock.mockRejectedValue(recentErr);

    setup();
    fillPasswords('Current1!', 'StrongP@ss1', 'StrongP@ss1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });

    await waitFor(() => {
      expect(toastCalls.error).toHaveBeenCalledTimes(1);
      const [title] = toastCalls.error.mock.calls[0] as [string, string];
      expect(title).toMatch(/re-enter|password/i);
    });
    // Current password field cleared + sheet stays open for retry.
    const currentInput = document.getElementById('cps-current') as HTMLInputElement;
    expect(currentInput.value).toBe('');
  });

  it('surfaces auth/weak-password from the server as a new-password error', async () => {
    // The client-side strength meter allows the submit, but Firebase can
    // still reject — e.g. if the project configures a stricter policy.
    reauthenticateWithCredentialMock.mockResolvedValue(undefined);
    const weakErr = Object.assign(new Error('weak'), { code: 'auth/weak-password' });
    updatePasswordMock.mockRejectedValue(weakErr);

    setup();
    fillPasswords('Current1!', 'StrongP@ss1', 'StrongP@ss1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });

    await waitFor(() => {
      expect(toastCalls.error).toHaveBeenCalledTimes(1);
      const [title] = toastCalls.error.mock.calls[0] as [string, string];
      expect(title).toMatch(/weak/i);
    });
  });
});
