/**
 * Auth Errors — canonical FE-facing error parser + user-message map.
 *
 * Moved from `frontend/src/lib/error-handler.ts` (δ phase 2, 2026-05-12) per
 * spec §2.10 of FE-AUTH-LAYOUT.md.
 *
 * Important: `AuthError` (the class) stays declared in `@/lib/error-handler`
 * because it `extends AppError`, and the ES-module evaluation cycle between
 * these two files would TDZ on `AppError` if the class were declared here.
 * The CLASS is RE-EXPORTED below for callers who want a single canonical
 * `@/auth/errors` import surface — that re-export is safe because by the
 * time anyone reads the binding, the cycle has resolved.
 *
 * The functions in this module — `parseError`, `isAuthError`,
 * `getUserFriendlyMessage` — only access the cyclic imports inside their
 * function bodies (runtime), so the cycle resolves cleanly.
 */

import {
  AppError,
  AuthError,
  ErrorCode,
  type ErrorCodeType,
  NetworkError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  FirebaseError,
  TimeoutError,
} from '@/lib/error-handler';

// Re-export so consumers can `import { AuthError } from '@/auth/errors'`
// without needing to know it physically lives in `error-handler.ts`.
export { AuthError } from '@/lib/error-handler';

// =============================================================================
// Internal helpers
// =============================================================================

function isRetryableFirebaseError(code?: string): boolean {
  if (!code) return false;

  const retryableCodes = [
    'unavailable',
    'resource-exhausted',
    'deadline-exceeded',
    'internal',
    'aborted',
  ];

  return retryableCodes.some((c) => code.includes(c));
}

// =============================================================================
// parseError — normalizes any error to an AppError
// =============================================================================

/**
 * Normalizes any error to an AppError.
 *
 * β5-3 fix (2026-05-12): when an error is sourced from Firebase Auth, the
 * `firebaseCode` is passed as a TOP-LEVEL constructor option so that
 * `AuthError#firebaseCode` is populated. Previously it was buried under
 * `context: { firebaseCode }`, which the ctor never read, causing every
 * unmapped-code path to fall through to "Please sign in to continue.".
 */
export function parseError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    if (
      (errorName === 'typeerror' && errorMessage.includes('fetch')) ||
      errorMessage.includes('network') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('net::')
    ) {
      return new NetworkError(error.message, { cause: error });
    }

    if (
      errorName.includes('firebase') ||
      errorMessage.includes('firebase') ||
      ('code' in error &&
        typeof (error as { code: unknown }).code === 'string' &&
        ((error as { code: string }).code.startsWith('auth/') ||
          (error as { code: string }).code.startsWith('firestore/') ||
          (error as { code: string }).code.startsWith('storage/') ||
          (error as { code: string }).code.startsWith('functions/')))
    ) {
      const firebaseCode = 'code' in error ? String((error as { code: unknown }).code) : undefined;
      const isAuth = firebaseCode?.startsWith('auth/');
      const isCallable = firebaseCode?.startsWith('functions/');

      if (isAuth) {
        return new AuthError(error.message, {
          cause: error,
          firebaseCode,
        });
      }

      if (isCallable) {
        const callableSubcode = firebaseCode?.slice('functions/'.length) ?? '';
        const message =
          error.message && error.message.length > 0
            ? error.message
            : 'The server rejected this request.';

        if (callableSubcode === 'unauthenticated') {
          return new AuthError(message, {
            cause: error,
            firebaseCode,
          });
        }
        if (callableSubcode === 'permission-denied') {
          return new AuthError(message, {
            cause: error,
            statusCode: 403,
            firebaseCode,
          });
        }
        if (callableSubcode === 'invalid-argument' || callableSubcode === 'failed-precondition') {
          return new ValidationError(message, {
            cause: error,
            context: { firebaseCode },
          });
        }
        if (callableSubcode === 'not-found') {
          return new NotFoundError(message, {
            cause: error,
          });
        }
        if (
          callableSubcode === 'unavailable' ||
          callableSubcode === 'deadline-exceeded' ||
          callableSubcode === 'cancelled'
        ) {
          return new NetworkError(message, {
            cause: error,
            kind: 'transient',
            context: { firebaseCode },
          });
        }
        return new FirebaseError(message, {
          cause: error,
          firebaseCode,
          isRetryable: isRetryableFirebaseError(callableSubcode),
        });
      }

      return new FirebaseError(error.message, {
        cause: error,
        firebaseCode,
        isRetryable: isRetryableFirebaseError(firebaseCode),
      });
    }

    if (errorMessage.includes('timeout') || errorName === 'aborterror') {
      return new TimeoutError(error.message, { cause: error });
    }

    return new AppError(error.message, { cause: error });
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;

    if ('status' in obj || 'statusCode' in obj) {
      const statusCode = Number(obj.status ?? obj.statusCode);
      const message = String(obj.message ?? obj.error ?? 'An error occurred');

      if (statusCode === 401 || statusCode === 403) {
        return new AuthError(message, { statusCode });
      }
      if (statusCode === 404) {
        return new NotFoundError(message);
      }
      if (statusCode === 400 || statusCode === 422) {
        return new ValidationError(message, {
          fieldErrors: obj.errors as Record<string, string[]> | undefined,
        });
      }

      return new AppError(message, {
        statusCode,
        isRetryable: statusCode >= 500,
      });
    }

    if ('message' in obj) {
      return new AppError(String(obj.message));
    }
  }

  if (typeof error === 'string') {
    return new AppError(error);
  }

  return new AppError('An unknown error occurred');
}

// =============================================================================
// isAuthError — detect auth errors (should redirect to login)
// =============================================================================

export function isAuthError(error: unknown): boolean {
  const appError = parseError(error);
  return (
    appError instanceof AuthError ||
    appError.code === ErrorCode.UNAUTHORIZED ||
    appError.code === ErrorCode.FORBIDDEN ||
    appError.code === ErrorCode.SESSION_EXPIRED
  );
}

// =============================================================================
// getUserFriendlyMessage — produce a toast-suitable string
// =============================================================================

/**
 * Get user-friendly error message.
 *
 * δ5 (2026-05-12): when an AuthError carries an unmapped firebaseCode (i.e. the
 * caller WAS in a sign-in attempt but the Firebase code is one we haven't seen),
 * the fallback is "Sign-in failed. Please try again." — NOT
 * "Please sign in to continue.". The latter is reserved for the "you're not
 * signed in" case (no firebaseCode at all).
 */
export function getUserFriendlyMessage(error: unknown): string {
  const appError = parseError(error);

  if (appError instanceof AuthError && appError.firebaseCode) {
    const authMessages: Record<string, string> = {
      // 2026-05-11 (Cinder-D5 / F7): collapse these three to identical neutral
      // copy. Distinguishable user-facing strings let an anonymous attacker
      // enumerate account existence via the FE Firebase SDK, defeating the
      // register-route's neutral-response design.
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/user-not-found': 'Email or password is incorrect.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      // F-DRACO-02 (2026-05-11): collapse account-exists codes to neutral copy.
      'auth/email-already-in-use':
        'Unable to create the account. Please try a different email or sign in.',
      'auth/credential-already-in-use':
        'Unable to create the account. Please try a different email or sign in.',
      'auth/internal-error': 'Sign-in failed. If this persists, try reinstalling the app.',
      'auth/session-expired': 'Your session has expired. Please sign in again.',
      'auth/network-request-failed': 'Network error. Please check your connection and try again.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/popup-closed-by-user': 'Sign-in was cancelled.',
      'auth/cancelled-popup-request': 'Sign-in was cancelled.',
      'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups and try again.',
      // 2026-05-12 (Tracer-A1): collapse to neutral copy to close A1-LOW enumeration channel — see [[appcheck-hunt-misdiagnosis-2026-05-12]]
      'auth/user-disabled': 'Email or password is incorrect.',
      'auth/account-exists-with-different-credential':
        'An account already exists with a different sign-in method.',
      'auth/requires-recent-login': 'Please sign in again to continue.',
      'auth/weak-password': 'Password is too weak. Please use a stronger password.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/missing-password': 'Please enter your password.',
      'auth/missing-email': 'Please enter your email address.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled.',
      // Track A (2026-05-12) — App Check / device-attestation / config codes
      // synthesized by the FE Firebase SDK from server error responses (per
      // `firebase-js-sdk` totp:953-956 server-error-to-client-code conversion).
      // Without these explicit mappings the codes fell through to the δ5
      // generic fallback at line 278 and the user saw "Sign-in failed. Please
      // try again." regardless of the actual cause.
      'auth/firebase-app-check-token-is-invalid':
        'Device verification failed. Please reinstall the app or check your network.',
      'auth/captcha-check-failed':
        'Device verification failed. Please reinstall the app or check your network.',
      'auth/missing-app-credential':
        'Device verification failed. Please reinstall the app or check your network.',
      'auth/invalid-app-credential':
        'Device verification failed. Please reinstall the app or check your network.',
      'auth/app-not-authorized':
        'This device is not authorized to sign in. Please update or reinstall the app.',
      'auth/invalid-cert-hash':
        'This device is not authorized to sign in. Please update or reinstall the app.',
      'auth/invalid-api-key':
        'App configuration error. Please reinstall the app or contact support.',
      'auth/unauthorized-domain':
        'This domain is not authorized for sign-in. Please contact support.',
      'auth/recaptcha-not-enabled':
        'Device verification failed. Please reinstall the app or check your network.',
      'auth/invalid-recaptcha-token':
        'Device verification failed. Please reinstall the app or check your network.',
      'auth/timeout': 'The sign-in request timed out. Please try again.',
      'auth/web-storage-unsupported':
        'Sign-in unavailable: browser storage is disabled. Please enable cookies or try a different browser.',
      'app-check/token-error': 'Device verification failed. Try reinstalling the app.',
    };

    const mapped = authMessages[appError.firebaseCode];
    if (mapped) {
      return mapped;
    }
    // δ5 default branch: unmapped firebaseCode means the user WAS attempting a
    // sign-in (the code came from the FE Firebase SDK) but we don't recognise
    // the specific failure. Return a sign-in-attempt-flavoured fallback instead
    // of falling through to the UNAUTHORIZED code-table entry, which speaks to
    // the "you're not signed in" case and is wrong here.
    return 'Sign-in failed. Please try again.';
  }

  if (appError instanceof RateLimitError) {
    const retryAfter = appError.retryAfterSeconds;
    if (retryAfter && retryAfter > 0 && retryAfter < 120) {
      return `You're going too fast. Try again in ${retryAfter} second${
        retryAfter === 1 ? '' : 's'
      }.`;
    }
    return "You're going too fast. Try again in a moment.";
  }

  if (appError instanceof NetworkError) {
    switch (appError.kind) {
      case 'app_check_missing':
      case 'app_check_rejected':
        return 'Booking unavailable on this device. Reinstall the app or contact support.';
      case 'auth_expired':
        return 'Your session has expired. Please sign in again.';
      case 'region_404':
        return 'Service temporarily misconfigured. Please try again in a few minutes.';
      case 'transient':
        return 'Connection hiccup. Please try again.';
      case 'cors_rejected':
        return 'Unable to reach the booking service from this device.';
      case 'unknown':
      default:
        break;
    }
  }

  // Scoped pass-through: if a callable threw 'not-found' with a custom
  // message (e.g. "Booking not found", "Availability data not found"),
  // surface it directly. The literal "Resource not found" is the
  // NotFoundError class-default placeholder used when no explicit
  // message was supplied — never user-meaningful, so fall through to
  // the generic mapping below.
  if (
    appError.code === ErrorCode.NOT_FOUND &&
    appError.message &&
    appError.message !== 'Resource not found'
  ) {
    return appError.message;
  }

  const messages: Partial<Record<ErrorCodeType, string>> = {
    [ErrorCode.NETWORK_ERROR]: 'Unable to connect. Please check your internet connection.',
    [ErrorCode.TIMEOUT]: 'The request took too long. Please try again.',
    [ErrorCode.APP_CHECK_FAILED]:
      'Booking unavailable on this device. Reinstall the app or contact support.',
    [ErrorCode.UNAUTHORIZED]: 'Please sign in to continue.',
    [ErrorCode.FORBIDDEN]: "You don't have permission to perform this action.",
    [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
    [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
    [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
    [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  };

  return messages[appError.code] ?? 'Something went wrong. Please try again.';
}
