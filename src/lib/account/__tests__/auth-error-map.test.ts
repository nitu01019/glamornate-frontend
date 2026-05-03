/**
 * Tests for `auth-error-map`.
 *
 * Goals:
 *   - Every known code has a distinct `{ title, body }` and never falls
 *     through to the `'unknown'` fallback.
 *   - Firebase Auth `.code` strings resolve correctly.
 *   - HttpsError `.code` variants (prefixed and bare) resolve correctly.
 *   - 3A's `details.code` takes precedence over `err.code`.
 *   - 3A's `account/*` `.message` fallback resolves correctly.
 *   - Unknown / missing codes safely route to the fallback copy.
 *   - No raw `err.message` is ever returned as the body.
 */

import { describe, it, expect } from 'vitest';
import {
  mapAuthError,
  KNOWN_AUTH_ERROR_CODES,
  type KnownAuthErrorCode,
} from '../auth-error-map';

describe('mapAuthError', () => {
  // -------------------------------------------------------------------------
  // Coverage over the entire catalogue
  // -------------------------------------------------------------------------

  it('has a mapping for every advertised code', () => {
    expect(KNOWN_AUTH_ERROR_CODES.length).toBeGreaterThan(0);
    for (const code of KNOWN_AUTH_ERROR_CODES) {
      const mapped = mapAuthError({ code });
      expect(mapped.code, `code=${code}`).toBe(code);
      expect(mapped.title.length, `code=${code} title`).toBeGreaterThan(0);
      expect(mapped.body.length, `code=${code} body`).toBeGreaterThan(0);
    }
  });

  it('produces distinct titles OR bodies for each Firebase Auth code', () => {
    const seen = new Map<string, KnownAuthErrorCode>();
    for (const code of KNOWN_AUTH_ERROR_CODES) {
      if (!code.startsWith('auth/')) continue;
      const mapped = mapAuthError({ code });
      const signature = `${mapped.title}|${mapped.body}`;
      if (seen.has(signature)) {
        throw new Error(
          `Duplicate copy for ${code} vs ${seen.get(signature)!}`,
        );
      }
      seen.set(signature, code);
    }
  });

  // -------------------------------------------------------------------------
  // Firebase Auth direct codes
  // -------------------------------------------------------------------------

  it('maps auth/wrong-password to the currentPassword field', () => {
    const out = mapAuthError({ code: 'auth/wrong-password' });
    expect(out.code).toBe('auth/wrong-password');
    expect(out.fieldTarget).toBe('currentPassword');
    expect(out.title).toMatch(/incorrect/i);
  });

  it('maps auth/weak-password to the newPassword field', () => {
    const out = mapAuthError({ code: 'auth/weak-password' });
    expect(out.fieldTarget).toBe('newPassword');
    expect(out.title).toMatch(/weak/i);
  });

  it('maps auth/requires-recent-login to currentPassword', () => {
    const out = mapAuthError({ code: 'auth/requires-recent-login' });
    expect(out.fieldTarget).toBe('currentPassword');
    expect(out.title).toMatch(/re-enter|recent|password/i);
  });

  it('maps auth/network-request-failed to a banner (no fieldTarget)', () => {
    const out = mapAuthError({ code: 'auth/network-request-failed' });
    expect(out.fieldTarget).toBeNull();
    expect(out.title).toMatch(/internet|connection/i);
  });

  it('maps auth/too-many-requests to a banner', () => {
    const out = mapAuthError({ code: 'auth/too-many-requests' });
    expect(out.fieldTarget).toBeNull();
    expect(out.title).toMatch(/too many/i);
  });

  it('maps auth/invalid-credential to currentPassword', () => {
    const out = mapAuthError({ code: 'auth/invalid-credential' });
    expect(out.fieldTarget).toBe('currentPassword');
  });

  it('maps auth/user-not-found', () => {
    const out = mapAuthError({ code: 'auth/user-not-found' });
    expect(out.code).toBe('auth/user-not-found');
    expect(out.title.toLowerCase()).toContain('account');
  });

  it('maps auth/user-disabled', () => {
    const out = mapAuthError({ code: 'auth/user-disabled' });
    expect(out.code).toBe('auth/user-disabled');
    expect(out.title).toMatch(/disabled/i);
  });

  it('maps auth/user-mismatch', () => {
    const out = mapAuthError({ code: 'auth/user-mismatch' });
    expect(out.code).toBe('auth/user-mismatch');
    expect(out.fieldTarget).toBe('currentPassword');
  });

  // -------------------------------------------------------------------------
  // HttpsError: prefixed and bare variants
  // -------------------------------------------------------------------------

  it('maps functions/failed-precondition (prefixed) to currentPassword', () => {
    const out = mapAuthError({ code: 'functions/failed-precondition' });
    expect(out.code).toBe('functions/failed-precondition');
    expect(out.fieldTarget).toBe('currentPassword');
  });

  it('maps bare HttpsError codes by prefixing them with functions/', () => {
    const out = mapAuthError({ code: 'unauthenticated' });
    expect(out.code).toBe('functions/unauthenticated');
  });

  it('maps bare `invalid-argument` to functions/invalid-argument', () => {
    const out = mapAuthError({ code: 'invalid-argument' });
    expect(out.code).toBe('functions/invalid-argument');
  });

  it('maps bare `internal` to functions/internal', () => {
    const out = mapAuthError({ code: 'internal' });
    expect(out.code).toBe('functions/internal');
  });

  it('maps deadline-exceeded', () => {
    const out = mapAuthError({ code: 'deadline-exceeded' });
    expect(out.code).toBe('functions/deadline-exceeded');
  });

  it('maps unavailable', () => {
    const out = mapAuthError({ code: 'unavailable' });
    expect(out.code).toBe('functions/unavailable');
  });

  // -------------------------------------------------------------------------
  // Detail code takes precedence
  // -------------------------------------------------------------------------

  it('prefers details.code over err.code when both are present', () => {
    const out = mapAuthError({
      code: 'failed-precondition',
      details: { code: 'account/requires-recent-login' },
    });
    expect(out.code).toBe('account/requires-recent-login');
    expect(out.fieldTarget).toBe('currentPassword');
  });

  // -------------------------------------------------------------------------
  // .message fallback (3A plain-string HttpsError shape)
  // -------------------------------------------------------------------------

  it('resolves account/* codes from err.message when no code is present', () => {
    const out = mapAuthError({ message: 'account/audit-log-failed' });
    expect(out.code).toBe('account/audit-log-failed');
    expect(out.title.length).toBeGreaterThan(0);
  });

  it('resolves account/requires-recent-login from err.message', () => {
    const out = mapAuthError({ message: 'account/requires-recent-login' });
    expect(out.code).toBe('account/requires-recent-login');
  });

  it('resolves account/invalid-confirmation from err.message', () => {
    const out = mapAuthError({ message: 'account/invalid-confirmation' });
    expect(out.code).toBe('account/invalid-confirmation');
  });

  it('resolves account/unauthenticated from err.message', () => {
    const out = mapAuthError({ message: 'account/unauthenticated' });
    expect(out.code).toBe('account/unauthenticated');
  });

  // -------------------------------------------------------------------------
  // Unknown / missing codes — safe fallback
  // -------------------------------------------------------------------------

  it('returns the unknown fallback for empty input', () => {
    const out = mapAuthError({});
    expect(out.code).toBe('unknown');
    expect(out.title.length).toBeGreaterThan(0);
    expect(out.body.length).toBeGreaterThan(0);
  });

  it('returns the unknown fallback for null / primitive input', () => {
    expect(mapAuthError(null).code).toBe('unknown');
    expect(mapAuthError(undefined).code).toBe('unknown');
    expect(mapAuthError('oops').code).toBe('unknown');
    expect(mapAuthError(42).code).toBe('unknown');
  });

  it('returns the unknown fallback for a truly unknown code', () => {
    const out = mapAuthError({ code: 'auth/totally-made-up' });
    expect(out.code).toBe('unknown');
  });

  it('returns the unknown fallback when details.code is present but unmapped', () => {
    const out = mapAuthError({ details: { code: 'account/zzz' } });
    expect(out.code).toBe('unknown');
  });

  it('never leaks raw err.message into the user-facing body', () => {
    const secret = 'FIREBASE_STACK_secret_trace_goes_here';
    const out = mapAuthError({ code: 'auth/wrong-password', message: secret });
    expect(out.body).not.toContain(secret);
  });

  it('skips empty string codes gracefully', () => {
    const out = mapAuthError({ code: '' });
    expect(out.code).toBe('unknown');
  });

  // -------------------------------------------------------------------------
  // Real Firebase-shaped errors
  // -------------------------------------------------------------------------

  it('handles a classic FirebaseError-shaped object', () => {
    class FakeFbError extends Error {
      code = 'auth/wrong-password';
    }
    const out = mapAuthError(new FakeFbError('Firebase: …'));
    expect(out.code).toBe('auth/wrong-password');
  });

  it('handles a FunctionsError with message="account/audit-log-failed"', () => {
    class FakeFnError extends Error {
      code = 'internal';
      constructor() {
        super('account/audit-log-failed');
      }
    }
    const out = mapAuthError(new FakeFnError());
    // Priority: no details.code present; err.code="internal" wins over
    // message resolution per the extractCode ordering.
    expect(out.code).toBe('functions/internal');
  });

  it('prefers details.code over message for a FunctionsError', () => {
    class FakeFnError extends Error {
      code = 'internal';
      details: unknown = { code: 'account/audit-log-failed' };
      constructor() {
        super('account/audit-log-failed');
      }
    }
    const out = mapAuthError(new FakeFnError());
    expect(out.code).toBe('account/audit-log-failed');
  });

  // -------------------------------------------------------------------------
  // Branch coverage for the extractor
  // -------------------------------------------------------------------------

  it('ignores details with a non-string code', () => {
    const out = mapAuthError({
      details: { code: 42 },
      code: 'auth/wrong-password',
    });
    expect(out.code).toBe('auth/wrong-password');
  });

  it('ignores details with an empty string code', () => {
    const out = mapAuthError({
      details: { code: '' },
      code: 'auth/wrong-password',
    });
    expect(out.code).toBe('auth/wrong-password');
  });

  it('trims whitespace around account/* message strings', () => {
    const out = mapAuthError({ message: '   account/audit-log-failed  ' });
    expect(out.code).toBe('account/audit-log-failed');
  });

  it('ignores a message that does not start with account/', () => {
    const out = mapAuthError({ message: 'some unrelated text' });
    expect(out.code).toBe('unknown');
  });

  it('routes err.code=account/* directly (no message fallback needed)', () => {
    const out = mapAuthError({ code: 'account/audit-log-failed' });
    expect(out.code).toBe('account/audit-log-failed');
  });

  it('returns unknown for unmapped err.code that is none of the known prefixes', () => {
    const out = mapAuthError({ code: 'some/thing-else' });
    expect(out.code).toBe('unknown');
  });
});
