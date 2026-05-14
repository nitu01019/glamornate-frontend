/**
 * /customer/account/link — recovery flow tests (A-6-01).
 *
 * Covers:
 *   - empty sessionStorage → informational copy + nav back to bookings
 *   - providerId='google.com' pending → password form, link via signIn +
 *     linkWithCredential, success route to dashboard
 *   - providerId='password' pending → "Continue with Google" path
 *   - reset password button calls resetPassword(email) and disables itself
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks — registered before the component imports resolve.
// ---------------------------------------------------------------------------

const replace = vi.fn();
const push = vi.fn();
const back = vi.fn();

const toastSuccess = vi.fn();
const toastError = vi.fn();

const signIn = vi.fn();
const signInWithGoogle = vi.fn();
const resetPassword = vi.fn();

const linkWithCredentialMock = vi.fn();
const credentialFactory = vi.fn((idToken: string | null, accessToken: string | null) => ({
  providerId: 'google.com',
  idToken,
  accessToken,
}));

let mockFirebaseUser: { uid: string } | null = null;
let mockIsAuthenticated = false;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push, back }),
}));

vi.mock('@/lib/providers', () => ({
  useToastActions: () => ({
    success: toastSuccess,
    error: toastError,
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    user: null,
    firebaseUser: mockFirebaseUser,
    isLoading: false,
    authResolved: true,
    isAuthenticated: mockIsAuthenticated,
    signIn,
    signUp: vi.fn(),
    signInWithGoogle,
    signOut: vi.fn(),
    resetPassword,
    refreshUser: vi.fn(),
  }),
}));

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseAuth: () => ({ currentUser: { uid: 'primary-uid' } }),
}));

vi.mock('@/components/ProtectedRoute', () => ({
  // PublicRoute simply renders children for the test — we don't exercise
  // the redirect behaviour here.
  PublicRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('firebase/auth');
  return {
    ...actual,
    GoogleAuthProvider: { credential: credentialFactory },
    linkWithCredential: linkWithCredentialMock,
  };
});

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SS_KEY = 'glamornate.pendingCredential';

function setPending(value: unknown): void {
  sessionStorage.setItem(SS_KEY, JSON.stringify(value));
}

async function loadPage(): Promise<React.ComponentType> {
  const mod = await import('../page');
  return mod.default;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountLinkPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    replace.mockClear();
    push.mockClear();
    back.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
    signIn.mockClear();
    signInWithGoogle.mockClear();
    resetPassword.mockClear();
    linkWithCredentialMock.mockClear();
    credentialFactory.mockClear();
    mockFirebaseUser = null;
    mockIsAuthenticated = false;
    vi.resetModules();
  });

  it('shows informational copy when sessionStorage has no pendingCredential', async () => {
    const Page = await loadPage();
    render(<Page />);
    expect(
      await screen.findByRole('heading', { level: 2, name: /how linking works/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to bookings/i })).toBeInTheDocument();
  });

  it('renders the Google-link form when pendingCredential.providerId is google.com', async () => {
    setPending({
      providerId: 'google.com',
      idToken: 'id-token-abc',
      accessToken: 'access-token-xyz',
    });
    const Page = await loadPage();
    render(<Page />);

    expect(
      await screen.findByRole('heading', { level: 1, name: /add google to your account/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('signs in then links the Google credential and routes to /customer/dashboard', async () => {
    setPending({
      providerId: 'google.com',
      idToken: 'id-token-abc',
      accessToken: 'access-token-xyz',
    });
    signIn.mockResolvedValueOnce(undefined);
    linkWithCredentialMock.mockResolvedValueOnce({});

    const user = userEvent.setup();
    const Page = await loadPage();
    render(<Page />);

    await user.type(await screen.findByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /link google to this account/i }));

    // 2026-05-11 (Mire-D1 + Keystone-M3 / F5): signIn must be called with
    // { isLinkFlow: true } so the cross-provider overwrite branch is
    // suppressed when the user mistypes their email on this page.
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('jane@example.com', 'hunter2hunter2', {
        isLinkFlow: true,
      }),
    );
    expect(credentialFactory).toHaveBeenCalledWith('id-token-abc', 'access-token-xyz');
    expect(linkWithCredentialMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/customer/dashboard'));
    expect(toastSuccess).toHaveBeenCalled();
    // sessionStorage cleared after success.
    expect(sessionStorage.getItem(SS_KEY)).toBeNull();
  });

  it('renders the Continue-with-Google flow when pendingCredential.providerId is password', async () => {
    setPending({ providerId: 'password', email: 'jane@example.com' });
    const Page = await loadPage();
    render(<Page />);

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: /this email is registered with google/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /email me a password reset link/i }),
    ).toBeInTheDocument();
  });

  it('triggers signInWithGoogle and routes to dashboard on success (password path)', async () => {
    setPending({ providerId: 'password', email: 'jane@example.com' });
    signInWithGoogle.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    const Page = await loadPage();
    render(<Page />);

    await user.click(await screen.findByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/customer/dashboard'));
    expect(toastSuccess).toHaveBeenCalled();
    expect(sessionStorage.getItem(SS_KEY)).toBeNull();
  });

  it('calls resetPassword(email) and disables the button after a successful send', async () => {
    setPending({ providerId: 'password', email: 'jane@example.com' });
    resetPassword.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    const Page = await loadPage();
    render(<Page />);

    const resetBtn = await screen.findByRole('button', { name: /email me a password reset link/i });
    await user.click(resetBtn);

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('jane@example.com'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /reset email sent/i })).toBeDisabled(),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('surfaces a friendly error message when linkWithCredential rejects', async () => {
    setPending({
      providerId: 'google.com',
      idToken: 'id-token-abc',
      accessToken: 'access-token-xyz',
    });
    signIn.mockResolvedValueOnce(undefined);
    const fbError = Object.assign(new Error('already linked'), {
      code: 'auth/credential-already-in-use',
      name: 'FirebaseError',
    });
    linkWithCredentialMock.mockRejectedValueOnce(fbError);

    const user = userEvent.setup();
    const Page = await loadPage();
    render(<Page />);

    await user.type(await screen.findByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /link google to this account/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // Don't navigate on failure.
    expect(replace).not.toHaveBeenCalled();
    // 2026-05-11 (Mire-D2 / F6): sessionStorage CLEARED on terminal error
    // codes (auth/credential-already-in-use is terminal). Previously it was
    // retained, which allowed the credential to be replayed against the
    // wrong user on a subsequent mount — cross-identity binding chain.
    expect(sessionStorage.getItem(SS_KEY)).toBeNull();
  });
});
