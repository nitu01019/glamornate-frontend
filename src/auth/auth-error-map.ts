/**
 * Single source of truth for mapping auth / account errors to user-facing
 * copy.
 *
 * Consumers:
 *   - `ChangePasswordSheet` — surfaces field-targeted errors after a
 *     Firebase Auth operation (reauthenticate / updatePassword).
 *   - `DeleteAccountSheet` — surfaces both Firebase Auth errors (re-auth
 *     step) AND HttpsError codes returned by the `deleteAccount` callable
 *     (3A's server contract).
 *   - Future Phase 4 location / address flows that also trip into auth
 *     errors.
 *
 * Design principles:
 *   1. No emojis, no jargon, no error codes in the body.
 *   2. Every returned entry has a distinct title + body so QA can
 *      visually diff failures without re-reading tests.
 *   3. The raw `code` is preserved in the return value so callers can
 *      route flow control (e.g. reopen re-auth step on
 *      `requires-recent-login`) without re-parsing strings.
 *   4. `.message` from Firebase is NEVER leaked to the user — only
 *      mapped copy is ever rendered.
 *
 * Handoff note for Alpha (PHASE_4.md B→A):
 *   The keys below are the STABLE contract. Rename at your own peril:
 *   any Phase 4 copy iteration should edit the values but not the keys.
 */

// ---------------------------------------------------------------------------
// Known code catalogue
// ---------------------------------------------------------------------------

/**
 * The set of codes this module knows about. We keep them as a string
 * union instead of an enum so that callers can narrow on them directly.
 */
export type KnownAuthErrorCode =
  // Firebase Auth SDK codes (client-side)
  | 'auth/wrong-password'
  | 'auth/weak-password'
  | 'auth/requires-recent-login'
  | 'auth/network-request-failed'
  | 'auth/too-many-requests'
  | 'auth/invalid-credential'
  | 'auth/user-not-found'
  | 'auth/user-disabled'
  | 'auth/user-mismatch'
  | 'auth/invalid-email'
  | 'auth/email-already-in-use'
  | 'auth/missing-password'
  | 'auth/internal-error'
  // HttpsError codes (3A `deleteAccount` callable)
  | 'functions/unauthenticated'
  | 'functions/failed-precondition'
  | 'functions/invalid-argument'
  | 'functions/internal'
  | 'functions/deadline-exceeded'
  | 'functions/unavailable'
  // Domain-specific detail strings returned by 3A
  | 'account/unauthenticated'
  | 'account/requires-recent-login'
  | 'account/invalid-confirmation'
  | 'account/audit-log-failed';

export interface MappedAuthError {
  /** Short, user-facing headline — suitable for a toast title. */
  readonly title: string;
  /** Longer user-facing body — suitable for a toast description. */
  readonly body: string;
  /** Canonical error code. `'unknown'` when we could not map it. */
  readonly code: KnownAuthErrorCode | 'unknown';
  /**
   * For change-password flows, indicates which input field the error
   * belongs to (so the UI can highlight it). `null` for banner-style
   * errors that do not target a single field.
   */
  readonly fieldTarget: 'currentPassword' | 'newPassword' | null;
}

// ---------------------------------------------------------------------------
// Copy table
// ---------------------------------------------------------------------------

type CopyEntry = Omit<MappedAuthError, 'code'>;

const COPY: Record<KnownAuthErrorCode, CopyEntry> = {
  // -------- Firebase Auth SDK --------
  'auth/wrong-password': {
    title: 'Incorrect current password',
    body: 'The password you entered does not match our records. Please try again.',
    fieldTarget: 'currentPassword',
  },
  'auth/weak-password': {
    title: 'New password is too weak',
    body: 'Choose a password with at least 8 characters that mixes letters, numbers, and symbols.',
    fieldTarget: 'newPassword',
  },
  'auth/requires-recent-login': {
    title: 'Please re-enter your password',
    body: 'For your security, this action requires a fresh sign-in. Enter your current password to continue.',
    fieldTarget: 'currentPassword',
  },
  'auth/network-request-failed': {
    title: 'No internet connection',
    body: 'Check your connection and try again.',
    fieldTarget: null,
  },
  'auth/too-many-requests': {
    title: 'Too many attempts',
    body: 'We have temporarily blocked this action because of too many attempts. Wait a few minutes and try again.',
    fieldTarget: null,
  },
  'auth/invalid-credential': {
    title: 'Sign-in details could not be verified',
    body: 'The credentials you provided are invalid or have expired. Please try again.',
    fieldTarget: 'currentPassword',
  },
  'auth/user-not-found': {
    title: 'Account not found',
    body: 'We could not find an account for this user. If you just signed up, wait a moment and try again.',
    fieldTarget: null,
  },
  'auth/user-disabled': {
    title: 'This account is disabled',
    body: 'Your account has been disabled. Please contact support for help.',
    fieldTarget: null,
  },
  'auth/user-mismatch': {
    title: 'Wrong account',
    body: 'The credentials you entered belong to a different account. Sign in again as the correct user.',
    fieldTarget: 'currentPassword',
  },
  'auth/invalid-email': {
    title: 'Invalid email',
    body: 'The email address on this account is not valid.',
    fieldTarget: null,
  },
  'auth/email-already-in-use': {
    title: 'Email already in use',
    body: 'Another account is already using this email address.',
    fieldTarget: null,
  },
  'auth/missing-password': {
    title: 'Password required',
    body: 'Enter your password to continue.',
    fieldTarget: 'currentPassword',
  },
  'auth/internal-error': {
    title: 'Something went wrong',
    body: 'Our sign-in service had a hiccup. Please try again in a moment.',
    fieldTarget: null,
  },

  // -------- HttpsError from `deleteAccount` callable --------
  'functions/unauthenticated': {
    title: 'Please sign in again',
    body: 'Your session has expired. Sign in again to continue.',
    fieldTarget: null,
  },
  'functions/failed-precondition': {
    title: 'Please re-enter your password',
    body: 'For your security, this action requires a fresh sign-in. Enter your current password to continue.',
    fieldTarget: 'currentPassword',
  },
  'functions/invalid-argument': {
    title: 'Confirmation did not match',
    body: 'Please type the confirmation phrase exactly as shown and try again.',
    fieldTarget: null,
  },
  'functions/internal': {
    title: 'Deletion could not be completed',
    body: 'Something went wrong while deleting your account. Our team has been notified. Please try again shortly.',
    fieldTarget: null,
  },
  'functions/deadline-exceeded': {
    title: 'Deletion is still in progress',
    body: 'Your deletion is taking longer than expected. We will keep processing it in the background and you will be signed out shortly.',
    fieldTarget: null,
  },
  'functions/unavailable': {
    title: 'Service temporarily unavailable',
    body: 'Our servers are temporarily unreachable. Please try again in a moment.',
    fieldTarget: null,
  },

  // -------- Domain-specific detail codes from 3A --------
  'account/unauthenticated': {
    title: 'Please sign in again',
    body: 'You need to sign in to delete your account.',
    fieldTarget: null,
  },
  'account/requires-recent-login': {
    title: 'Please re-enter your password',
    body: 'For your security, account deletion requires a fresh sign-in. Enter your current password to continue.',
    fieldTarget: 'currentPassword',
  },
  'account/invalid-confirmation': {
    title: 'Confirmation did not match',
    body: 'Please type the confirmation phrase exactly as shown and try again.',
    fieldTarget: null,
  },
  'account/audit-log-failed': {
    title: 'Deletion could not be started',
    body: 'We could not record the deletion request. No data was removed. Please try again shortly.',
    fieldTarget: null,
  },
};

const UNKNOWN_COPY: MappedAuthError = {
  title: 'Something went wrong',
  body: 'An unexpected error occurred. Please try again.',
  code: 'unknown',
  fieldTarget: null,
};

// ---------------------------------------------------------------------------
// Error shape helpers
// ---------------------------------------------------------------------------

/**
 * Extract a code string from whatever the caller threw.
 *
 * Firebase Auth errors have `.code` of shape `'auth/xxx'`.
 * HttpsError (client-side) has `.code` of shape `'functions/xxx'` OR
 * just `'failed-precondition'` depending on SDK version — we normalize
 * both. 3A's callable also puts a domain code into `.details.code` OR
 * uses the plain HttpsError `.message` (e.g. `'account/audit-log-failed'`).
 *
 * Resolution order:
 *   1. `err.details.code` (3A detail code) — WINS if present because it
 *      is the most specific.
 *   2. `err.code` starting with `'auth/'` or `'functions/'` — pass through.
 *   3. `err.code` in `{'unauthenticated','failed-precondition',...}` —
 *      prefix with `'functions/'`.
 *   4. `err.message` starting with `'account/'` — 3A returns these as
 *      plain message strings.
 */
function extractCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;

  const e = err as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };

  // Priority 1: detail code (most specific)
  if (e.details && typeof e.details === 'object') {
    const detailCode = (e.details as { code?: unknown }).code;
    if (typeof detailCode === 'string' && detailCode.length > 0) {
      return detailCode;
    }
  }

  // Priority 2: explicit .code
  if (typeof e.code === 'string' && e.code.length > 0) {
    const c = e.code;
    if (c.startsWith('auth/') || c.startsWith('functions/')) return c;
    // HttpsError on some SDK versions returns bare token
    const httpsBareCodes = new Set([
      'unauthenticated',
      'failed-precondition',
      'invalid-argument',
      'internal',
      'deadline-exceeded',
      'unavailable',
      'permission-denied',
      'not-found',
      'already-exists',
      'resource-exhausted',
      'aborted',
      'out-of-range',
      'unimplemented',
      'data-loss',
      'cancelled',
    ]);
    if (httpsBareCodes.has(c)) return `functions/${c}`;
    if (c.startsWith('account/')) return c;
  }

  // Priority 3: .message fallback — 3A's HttpsError puts the detail code
  // into the human-facing `.message` field directly.
  if (typeof e.message === 'string') {
    const m = e.message.trim();
    if (m.startsWith('account/')) {
      // Split on whitespace to ignore any trailing description.
      return m.split(/\s+/)[0] ?? null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map any caught error into a user-facing `{ title, body, code }` shape.
 *
 * NEVER leaks `err.message` or stack traces to the UI — those stay in
 * the caller's `console.error`. The returned `body` is always pre-written
 * copy from `COPY` (or the fallback).
 *
 * Pure function: no side effects, no I/O.
 */
export function mapAuthError(err: unknown): MappedAuthError {
  const raw = extractCode(err);
  if (!raw) return UNKNOWN_COPY;

  const entry = (COPY as Record<string, CopyEntry | undefined>)[raw];
  if (!entry) return UNKNOWN_COPY;

  return {
    title: entry.title,
    body: entry.body,
    fieldTarget: entry.fieldTarget,
    code: raw as KnownAuthErrorCode,
  };
}

/**
 * Exposed so tests can enumerate all supported codes.
 */
export const KNOWN_AUTH_ERROR_CODES: readonly KnownAuthErrorCode[] = Object.keys(
  COPY,
) as readonly KnownAuthErrorCode[];
