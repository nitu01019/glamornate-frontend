/**
 * Global Error Handler - Custom error classes and retry utilities
 * Provides standardized error handling across the Glamornate application
 */

// =============================================================================
// Error Codes
// =============================================================================

export const ErrorCode = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',

  // App attestation (App Check) — distinct so the UI can render an actionable
  // message instead of the generic "Network request failed" toast. Driven by
  // a sideloaded debug-signed APK whose UUID is unregistered, or a release APK
  // whose signing-cert SHA-256 is missing from Firebase Console → App Check.
  APP_CHECK_FAILED: 'APP_CHECK_FAILED',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Firebase errors
  FIREBASE_ERROR: 'FIREBASE_ERROR',
  FIRESTORE_ERROR: 'FIRESTORE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Unknown
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// =============================================================================
// Base Error Class
// =============================================================================

export interface AppErrorOptions {
  code?: ErrorCodeType;
  statusCode?: number;
  isRetryable?: boolean;
  context?: Record<string, unknown>;
  cause?: Error;
}

export class AppError extends Error {
  readonly code: ErrorCodeType;
  readonly statusCode: number;
  readonly isRetryable: boolean;
  readonly context?: Record<string, unknown>;
  readonly timestamp: Date;
  readonly cause?: Error;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = options.code ?? ErrorCode.UNKNOWN;
    this.statusCode = options.statusCode ?? 500;
    this.isRetryable = options.isRetryable ?? false;
    this.context = options.context;
    this.timestamp = new Date();
    this.cause = options.cause;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

// =============================================================================
// Specific Error Classes
// =============================================================================

export type NetworkErrorKind =
  | 'app_check_missing'
  | 'app_check_rejected'
  | 'auth_expired'
  | 'cors_rejected'
  | 'region_404'
  | 'transient'
  | 'unknown';

export class NetworkError extends AppError {
  readonly kind: NetworkErrorKind;

  constructor(
    message = 'Network request failed',
    options: Omit<AppErrorOptions, 'code'> & { kind?: NetworkErrorKind } = {},
  ) {
    super(message, {
      ...options,
      code: ErrorCode.NETWORK_ERROR,
      statusCode: options.statusCode ?? 0,
      isRetryable: options.isRetryable ?? (options.kind === 'transient' || options.kind === undefined),
    });
    this.name = 'NetworkError';
    this.kind = options.kind ?? 'unknown';
  }
}

/**
 * App Check / device-attestation failure. Distinct from `NetworkError` because
 * the recovery is operator-side (register the device debug token / release-keystore
 * SHA-256 in Firebase Console), not "retry the request later".
 *
 * Surfaces from:
 *   - Capacitor JS App Check `CustomProvider.getToken` throwing `AppCheckTokenError`
 *     (`src/lib/app-check.ts`).
 *   - Backend `/api/v1/*` returning 401 with envelope code `'app-check-failed'`
 *     (`backend/functions/src/http/middleware/appCheck.ts`).
 *   - Firebase callable returning `functions/internal` or `functions/unauthenticated`
 *     when the JS SDK fired the request without `X-Firebase-AppCheck`.
 */
export class AppCheckError extends AppError {
  readonly tokenWasPresent: boolean;
  readonly providerKind: 'web_recaptcha' | 'native_play_integrity' | 'native_devicecheck' | 'native_debug' | 'unknown';

  constructor(
    message = 'App attestation unavailable on this device.',
    options: Omit<AppErrorOptions, 'code'> & {
      tokenWasPresent?: boolean;
      providerKind?: AppCheckError['providerKind'];
    } = {},
  ) {
    super(message, {
      ...options,
      code: ErrorCode.APP_CHECK_FAILED,
      statusCode: options.statusCode ?? 401,
      isRetryable: false,
    });
    this.name = 'AppCheckError';
    this.tokenWasPresent = options.tokenWasPresent ?? false;
    this.providerKind = options.providerKind ?? 'unknown';
  }
}

export class AuthError extends AppError {
  /** The original Firebase Auth / App Check error code (e.g. "auth/wrong-password"). Empty string when not sourced from Firebase. */
  readonly firebaseCode: string;

  constructor(
    message = 'Authentication required',
    options: Omit<AppErrorOptions, 'code'> & { firebaseCode?: string } = {},
  ) {
    super(message, {
      ...options,
      code: options.statusCode === 403 ? ErrorCode.FORBIDDEN : ErrorCode.UNAUTHORIZED,
      statusCode: options.statusCode ?? 401,
      isRetryable: false,
    });
    this.name = 'AuthError';
    this.firebaseCode = options.firebaseCode ?? '';
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message = 'Validation failed',
    options: Omit<AppErrorOptions, 'code'> & { fieldErrors?: Record<string, string[]> } = {}
  ) {
    super(message, {
      ...options,
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: options.statusCode ?? 400,
      isRetryable: false,
    });
    this.name = 'ValidationError';
    this.fieldErrors = options.fieldErrors;
  }
}

export class NotFoundError extends AppError {
  readonly resourceType?: string;
  readonly resourceId?: string;

  constructor(
    message = 'Resource not found',
    options: Omit<AppErrorOptions, 'code'> & { resourceType?: string; resourceId?: string } = {}
  ) {
    super(message, {
      ...options,
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      isRetryable: false,
    });
    this.name = 'NotFoundError';
    this.resourceType = options.resourceType;
    this.resourceId = options.resourceId;
  }
}

export class FirebaseError extends AppError {
  readonly firebaseCode?: string;

  constructor(
    message = 'Firebase operation failed',
    options: Omit<AppErrorOptions, 'code'> & { firebaseCode?: string } = {}
  ) {
    super(message, {
      ...options,
      code: ErrorCode.FIREBASE_ERROR,
      statusCode: options.statusCode ?? 500,
      isRetryable: options.isRetryable ?? false,
    });
    this.name = 'FirebaseError';
    this.firebaseCode = options.firebaseCode;
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'Request timed out', options: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, {
      ...options,
      code: ErrorCode.TIMEOUT,
      statusCode: 408,
      isRetryable: true,
    });
    this.name = 'TimeoutError';
  }
}

// =============================================================================
// Error Parsing & Detection
// =============================================================================

/**
 * Normalizes any error to an AppError
 */
export function parseError(error: unknown): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    // Detect network errors
    if (
      errorName === 'typeerror' && errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('net::')
    ) {
      return new NetworkError(error.message, { cause: error });
    }

    // Detect Firebase errors (Auth, Firestore, Storage, Functions/callable)
    if (
      errorName.includes('firebase') ||
      errorMessage.includes('firebase') ||
      'code' in error && typeof (error as { code: unknown }).code === 'string' &&
      ((error as { code: string }).code.startsWith('auth/') ||
       (error as { code: string }).code.startsWith('firestore/') ||
       (error as { code: string }).code.startsWith('storage/') ||
       (error as { code: string }).code.startsWith('functions/'))
    ) {
      const firebaseCode = 'code' in error ? String((error as { code: unknown }).code) : undefined;
      const isAuthError = firebaseCode?.startsWith('auth/');
      const isCallableError = firebaseCode?.startsWith('functions/');

      if (isAuthError) {
        return new AuthError(error.message, {
          cause: error,
          context: { firebaseCode }
        });
      }

      // Firebase HTTPS callables surface their errors as `functions/<code>`
      // (e.g. `functions/invalid-argument`, `functions/permission-denied`).
      // Map the most common ones to their typed AppError siblings so the
      // UI can render an actionable message instead of the generic
      // "Something went wrong" fallback. Preserves the backend-supplied
      // message verbatim so `getUserFriendlyMessage` shows it to the user.
      if (isCallableError) {
        const callableSubcode = firebaseCode?.slice('functions/'.length) ?? '';
        const message =
          error.message && error.message.length > 0
            ? error.message
            : 'The server rejected this request.';

        if (callableSubcode === 'unauthenticated') {
          return new AuthError(message, {
            cause: error,
            context: { firebaseCode },
          });
        }
        if (callableSubcode === 'permission-denied') {
          return new AuthError(message, {
            cause: error,
            statusCode: 403,
            context: { firebaseCode },
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
        // 'internal', 'unknown', 'aborted', 'resource-exhausted', etc.
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

    // Detect timeout errors
    if (errorMessage.includes('timeout') || errorName === 'aborterror') {
      return new TimeoutError(error.message, { cause: error });
    }

    // Generic error
    return new AppError(error.message, { cause: error });
  }

  // API Response error (has status code)
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

    // Object with message
    if ('message' in obj) {
      return new AppError(String(obj.message));
    }
  }

  // String error
  if (typeof error === 'string') {
    return new AppError(error);
  }

  // Unknown error type
  return new AppError('An unknown error occurred');
}

/**
 * Check if a Firebase error code is retryable
 */
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

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const appError = parseError(error);
  return appError.isRetryable;
}

/**
 * Check if an error is an auth error (should redirect to login)
 */
export function isAuthError(error: unknown): boolean {
  const appError = parseError(error);
  return appError instanceof AuthError || 
         appError.code === ErrorCode.UNAUTHORIZED || 
         appError.code === ErrorCode.FORBIDDEN ||
         appError.code === ErrorCode.SESSION_EXPIRED;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  const appError = parseError(error);

  // AuthError carries a `firebaseCode` field — map it to a user-facing string
  // suited for toast messages. Unrecognised codes fall through to the table
  // below so upstream (NetworkError, code table) handling is preserved.
  if (appError instanceof AuthError && appError.firebaseCode) {
    const authMessages: Record<string, string> = {
      'auth/wrong-password':                       'Incorrect password. Please try again.',
      'auth/user-not-found':                       'No account found with this email.',
      'auth/invalid-credential':                   'Invalid email or password.',
      'auth/email-already-in-use':                 'An account with this email already exists.',
      'auth/credential-already-in-use':            'An account with this email already exists with a different sign-in method.',
      'auth/internal-error':                       'Sign-in failed. If this persists, try reinstalling the app.',
      'auth/session-expired':                      'Your session has expired. Please sign in again.',
      'auth/network-request-failed':               'Network error. Please check your connection and try again.',
      'auth/too-many-requests':                    'Too many failed attempts. Please try again later.',
      'auth/popup-closed-by-user':                 'Sign-in was cancelled.',
      'auth/cancelled-popup-request':              'Sign-in was cancelled.',
      'auth/popup-blocked':                        'Sign-in popup was blocked. Please allow popups and try again.',
      'auth/user-disabled':                        'This account has been disabled. Please contact support.',
      'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
      'auth/requires-recent-login':                'Please sign in again to continue.',
      'auth/weak-password':                        'Password is too weak. Please use a stronger password.',
      'auth/invalid-email':                        'Invalid email address.',
      'auth/missing-password':                     'Please enter your password.',
      'auth/operation-not-allowed':                'This sign-in method is not enabled.',
      'app-check/token-error':                     'Device verification failed. Try reinstalling the app.',
    };

    const mapped = authMessages[appError.firebaseCode];
    if (mapped) {
      return mapped;
    }
    // Unrecognised firebase code — fall through to NetworkError + code table
  }

  // NetworkError carries a `kind` discriminator — render a kind-specific copy
  // when it differs from the generic NETWORK_ERROR fallback.
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
        // fall through to the table below
        break;
    }
  }

  const messages: Partial<Record<ErrorCodeType, string>> = {
    [ErrorCode.NETWORK_ERROR]: 'Unable to connect. Please check your internet connection.',
    [ErrorCode.TIMEOUT]: 'The request took too long. Please try again.',
    [ErrorCode.APP_CHECK_FAILED]: 'Booking unavailable on this device. Reinstall the app or contact support.',
    [ErrorCode.UNAUTHORIZED]: 'Please sign in to continue.',
    [ErrorCode.FORBIDDEN]: 'You don\'t have permission to perform this action.',
    [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
    [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
    [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
    [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  };

  return messages[appError.code] ?? appError.message ?? 'Something went wrong. Please try again.';
}

// =============================================================================
// Retry Utility
// =============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable */
  shouldRetry?: (error: AppError, attempt: number) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (error: AppError, attempt: number, delay: number) => void;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  shouldRetry: (error) => error.isRetryable,
  onRetry: () => {},
};

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: AppError;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseError(error);

      const isLastAttempt = attempt >= opts.maxAttempts;
      const shouldRetry = opts.shouldRetry(lastError, attempt);

      if (isLastAttempt || !shouldRetry) {
        throw lastError;
      }

      // Calculate next delay with jitter
      const jitter = Math.random() * 0.3 * delay;
      const nextDelay = Math.min(delay + jitter, opts.maxDelay);

      opts.onRetry(lastError, attempt, nextDelay);

      await sleep(nextDelay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// React Query Integration Helpers
// =============================================================================

/**
 * Get retry count based on error type (for React Query)
 */
export function getQueryRetryCount(failureCount: number, error: unknown): boolean {
  const appError = parseError(error);
  
  // Never retry auth errors
  if (isAuthError(error)) {
    return false;
  }
  
  // Retry network/timeout errors up to 3 times
  if (appError.isRetryable && failureCount < 3) {
    return true;
  }
  
  return false;
}

/**
 * Get retry delay with exponential backoff (for React Query)
 */
export function getQueryRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
}
