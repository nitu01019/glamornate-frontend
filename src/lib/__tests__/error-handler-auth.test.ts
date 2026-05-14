import { describe, it, expect } from 'vitest';
import { AuthError, getUserFriendlyMessage, parseError } from '../error-handler';

// =============================================================================
// getUserFriendlyMessage with AuthError — firebaseCode mapping
// =============================================================================
describe('getUserFriendlyMessage with AuthError', () => {
  // -------------------------------------------------------------------------
  // Known firebase codes → specific user-facing strings
  // -------------------------------------------------------------------------

  // 2026-05-11 (Cinder-D5 / F7): user-not-found / wrong-password /
  // invalid-credential intentionally collapse to one neutral string. A
  // distinguishable copy here leaks account existence via the anonymous FE
  // SDK path, defeating the register-route's neutral-response design.
  it('returns neutral copy for auth/wrong-password (anti-enumeration)', () => {
    const err = new AuthError('', { firebaseCode: 'auth/wrong-password' });
    expect(getUserFriendlyMessage(err)).toBe('Email or password is incorrect.');
  });

  it('returns neutral copy for auth/user-not-found (anti-enumeration)', () => {
    const err = new AuthError('', { firebaseCode: 'auth/user-not-found' });
    expect(getUserFriendlyMessage(err)).toBe('Email or password is incorrect.');
  });

  it('returns the SAME neutral copy for all three signin-failure codes', () => {
    const codes = ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential'];
    const messages = codes.map((c) =>
      getUserFriendlyMessage(new AuthError('', { firebaseCode: c })),
    );
    expect(new Set(messages).size).toBe(1);
  });

  it('returns specific message for auth/internal-error', () => {
    const err = new AuthError('', { firebaseCode: 'auth/internal-error' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Sign-in failed. If this persists, try reinstalling the app.',
    );
  });

  it('returns specific message for app-check/token-error', () => {
    const err = new AuthError('', { firebaseCode: 'app-check/token-error' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Device verification failed. Try reinstalling the app.',
    );
  });

  it('returns neutral message for auth/credential-already-in-use (F-DRACO-02)', () => {
    const err = new AuthError('', { firebaseCode: 'auth/credential-already-in-use' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Unable to create the account. Please try a different email or sign in.',
    );
  });

  it('returns neutral message for auth/email-already-in-use (F-DRACO-02)', () => {
    const err = new AuthError('', { firebaseCode: 'auth/email-already-in-use' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Unable to create the account. Please try a different email or sign in.',
    );
  });

  it('returns specific message for auth/popup-closed-by-user', () => {
    const err = new AuthError('', { firebaseCode: 'auth/popup-closed-by-user' });
    expect(getUserFriendlyMessage(err)).toBe('Sign-in was cancelled.');
  });

  // -------------------------------------------------------------------------
  // δ5 (2026-05-12) — REGRESSION GUARD for Part C of the auth-9.5+ spec.
  //
  // Before δ5: unmapped firebaseCode fell through to the UNAUTHORIZED
  // code-table entry → "Please sign in to continue.". That copy reads as
  // "you're not signed in", which is wrong: the user JUST attempted a
  // sign-in and Firebase returned a code we don't recognise yet. The new
  // default branch in getUserFriendlyMessage returns a sign-in-attempt-
  // flavoured fallback that doesn't mislead.
  //
  // Must NOT regress to:
  //   - "An error occurred. Please try again." (the old leaky generic copy)
  //   - "Something went wrong. Please try again." (the AppError fallback)
  //   - "Please sign in to continue." (the UNAUTHORIZED fallthrough we
  //     intentionally override here)
  // -------------------------------------------------------------------------

  it('returns sign-in-failed fallback for an unrecognised firebaseCode (δ5 Part C)', () => {
    const err = new AuthError('', { firebaseCode: 'auth/unknown-thing' });
    const result = getUserFriendlyMessage(err);
    expect(result).not.toBe('An error occurred. Please try again.');
    expect(result).not.toBe('Something went wrong. Please try again.');
    expect(result).not.toBe('Please sign in to continue.');
    expect(result).toBe('Sign-in failed. Please try again.');
  });

  // -------------------------------------------------------------------------
  // β5-3 REGRESSION GUARD (δ5 Part B, 2026-05-12).
  //
  // Before β5-3 fix: parseError put firebaseCode in `context: { firebaseCode }`
  // but the AuthError ctor reads `options.firebaseCode` DIRECTLY. The two
  // contracts didn't match, so every Firebase-sourced AuthError ended up with
  // `firebaseCode === ''` and every getUserFriendlyMessage call fell through
  // to "Please sign in to continue.". After the fix, parseError hoists
  // firebaseCode to the top-level option so the field is populated.
  // -------------------------------------------------------------------------

  it('parseError populates AuthError.firebaseCode from auth/* Firebase code (β5-3 guard)', () => {
    const firebaseLikeError = Object.assign(new Error('x'), {
      name: 'FirebaseError',
      code: 'auth/wrong-password',
    });
    const parsed = parseError(firebaseLikeError);
    expect(parsed).toBeInstanceOf(AuthError);
    expect((parsed as AuthError).firebaseCode).toBe('auth/wrong-password');
  });

  it('parseError populates firebaseCode for functions/unauthenticated callable errors (β5-3 guard)', () => {
    const callableError = Object.assign(new Error('x'), {
      name: 'FirebaseError',
      code: 'functions/unauthenticated',
    });
    const parsed = parseError(callableError);
    expect(parsed).toBeInstanceOf(AuthError);
    expect((parsed as AuthError).firebaseCode).toBe('functions/unauthenticated');
  });

  it('parseError populates firebaseCode for functions/permission-denied callable errors (β5-3 guard)', () => {
    const callableError = Object.assign(new Error('x'), {
      name: 'FirebaseError',
      code: 'functions/permission-denied',
    });
    const parsed = parseError(callableError);
    expect(parsed).toBeInstanceOf(AuthError);
    expect((parsed as AuthError).firebaseCode).toBe('functions/permission-denied');
    expect((parsed as AuthError).statusCode).toBe(403);
  });

  // -------------------------------------------------------------------------
  // AuthError without firebaseCode → code table (UNAUTHORIZED)
  // Verifies the guard path does not regress when firebaseCode is absent.
  // -------------------------------------------------------------------------

  it('falls back to UNAUTHORIZED code-table entry when firebaseCode is absent', () => {
    const err = new AuthError();
    const result = getUserFriendlyMessage(err);
    expect(result).toBe('Please sign in to continue.');
    expect(result).not.toBe('An error occurred. Please try again.');
  });

  // -------------------------------------------------------------------------
  // AuthError with ErrorCode.FORBIDDEN (statusCode 403) → FORBIDDEN message
  // -------------------------------------------------------------------------

  it('returns FORBIDDEN message when statusCode is 403', () => {
    const err = new AuthError('', { statusCode: 403 });
    expect(getUserFriendlyMessage(err)).toBe("You don't have permission to perform this action.");
  });
});

// =============================================================================
// App Check error codes (Track A) — 2026-05-12
//
// Hunt-D2/D3 confirmed App Check is ENFORCED on identitytoolkit, firestore, and
// firebasestorage for project glamornate-758c6. The web debug token is bound
// to the WEB Firebase app only; production APKs use Play Integrity. When App
// Check fails on the device (network, cert mismatch, integrity verdict), the
// Firebase SDK emits one of these auth/* codes which previously fell through
// to the δ5 generic "Sign-in failed. Please try again." fallback. Track A maps
// each to a specific actionable string so users know whether to reinstall,
// check network, update the app, or contact support.
//
// Verbatim strings are pinned to /tmp/auth-team-brief.md §3.1. Any drift
// between this test file and frontend/src/auth/errors.ts authMessages map will
// fail downstream impl-3's verification.
// =============================================================================
describe('App Check error codes (Track A)', () => {
  // -------------------------------------------------------------------------
  // Group 1: nine codes that collapse to the generic device-verification copy.
  // These all originate from App Check / reCAPTCHA / captcha failures where
  // the actionable user step is the same: reinstall or check network.
  // -------------------------------------------------------------------------

  it('returns device-verification copy for auth/firebase-app-check-token-is-invalid', () => {
    const err = new AuthError('', { firebaseCode: 'auth/firebase-app-check-token-is-invalid' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Device verification failed. Please reinstall the app or check your network.',
    );
  });

  it('returns device-verification copy for auth/captcha-check-failed', () => {
    const err = new AuthError('', { firebaseCode: 'auth/captcha-check-failed' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Device verification failed. Please reinstall the app or check your network.',
    );
  });

  it('returns device-verification copy for auth/missing-app-credential', () => {
    const err = new AuthError('', { firebaseCode: 'auth/missing-app-credential' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Device verification failed. Please reinstall the app or check your network.',
    );
  });

  it('returns device-verification copy for auth/invalid-app-credential', () => {
    const err = new AuthError('', { firebaseCode: 'auth/invalid-app-credential' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Device verification failed. Please reinstall the app or check your network.',
    );
  });

  it('returns device-verification copy for auth/recaptcha-not-enabled', () => {
    const err = new AuthError('', { firebaseCode: 'auth/recaptcha-not-enabled' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Device verification failed. Please reinstall the app or check your network.',
    );
  });

  it('returns device-verification copy for auth/invalid-recaptcha-token', () => {
    const err = new AuthError('', { firebaseCode: 'auth/invalid-recaptcha-token' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Device verification failed. Please reinstall the app or check your network.',
    );
  });

  // -------------------------------------------------------------------------
  // Group 2: two codes that surface a stronger "your APK is not authorized"
  // message. These map to cert-hash / SHA-1 mismatches; the actionable step
  // is to update or reinstall the app from the official channel.
  // -------------------------------------------------------------------------

  it('returns device-not-authorized copy for auth/app-not-authorized', () => {
    const err = new AuthError('', { firebaseCode: 'auth/app-not-authorized' });
    expect(getUserFriendlyMessage(err)).toBe(
      'This device is not authorized to sign in. Please update or reinstall the app.',
    );
  });

  it('returns device-not-authorized copy for auth/invalid-cert-hash', () => {
    const err = new AuthError('', { firebaseCode: 'auth/invalid-cert-hash' });
    expect(getUserFriendlyMessage(err)).toBe(
      'This device is not authorized to sign in. Please update or reinstall the app.',
    );
  });

  // -------------------------------------------------------------------------
  // Group 3: configuration errors. These point at app-side misconfiguration
  // (wrong API key, unauthorized domain) where the user can do little but
  // reinstall or contact support.
  // -------------------------------------------------------------------------

  it('returns config-error copy for auth/invalid-api-key', () => {
    const err = new AuthError('', { firebaseCode: 'auth/invalid-api-key' });
    expect(getUserFriendlyMessage(err)).toBe(
      'App configuration error. Please reinstall the app or contact support.',
    );
  });

  it('returns domain-unauthorized copy for auth/unauthorized-domain', () => {
    const err = new AuthError('', { firebaseCode: 'auth/unauthorized-domain' });
    expect(getUserFriendlyMessage(err)).toBe(
      'This domain is not authorized for sign-in. Please contact support.',
    );
  });

  // -------------------------------------------------------------------------
  // Group 4: transient / browser-environment errors. These have user-fixable
  // remediation (retry, enable cookies).
  // -------------------------------------------------------------------------

  it('returns timeout copy for auth/timeout', () => {
    const err = new AuthError('', { firebaseCode: 'auth/timeout' });
    expect(getUserFriendlyMessage(err)).toBe('The sign-in request timed out. Please try again.');
  });

  it('returns web-storage copy for auth/web-storage-unsupported', () => {
    const err = new AuthError('', { firebaseCode: 'auth/web-storage-unsupported' });
    expect(getUserFriendlyMessage(err)).toBe(
      'Sign-in unavailable: browser storage is disabled. Please enable cookies or try a different browser.',
    );
  });

  // -------------------------------------------------------------------------
  // Regression guard: an unmapped fake code MUST continue to fall through to
  // the δ5 default "Sign-in failed. Please try again." This protects against
  // an accidental change to the default branch when extending the map.
  // -------------------------------------------------------------------------

  it('still returns δ5 generic fallback for an unmapped fake code (regression guard)', () => {
    const err = new AuthError('', { firebaseCode: 'auth/totally-fake-xyz' });
    expect(getUserFriendlyMessage(err)).toBe('Sign-in failed. Please try again.');
  });
});
