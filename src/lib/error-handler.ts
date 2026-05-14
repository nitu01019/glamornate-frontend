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
      isRetryable:
        options.isRetryable ?? (options.kind === 'transient' || options.kind === undefined),
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
  readonly providerKind:
    | 'web_recaptcha'
    | 'native_play_integrity'
    | 'native_devicecheck'
    | 'native_debug'
    | 'unknown';

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

/**
 * AuthError — FE-facing class with `firebaseCode` field.
 *
 * Note (δ5, 2026-05-12): the class is declared here (next to its base
 * `AppError`) to keep ES-module evaluation linear. `parseError` /
 * `getUserFriendlyMessage` / `isAuthError` live in `@/auth/errors` and import
 * this class via a cyclic-but-benign edge — their function bodies use
 * `AuthError` only at RUNTIME, not at module-load time, so no TDZ.
 */
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
    options: Omit<AppErrorOptions, 'code'> & { fieldErrors?: Record<string, string[]> } = {},
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
    options: Omit<AppErrorOptions, 'code'> & { resourceType?: string; resourceId?: string } = {},
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
    options: Omit<AppErrorOptions, 'code'> & { firebaseCode?: string } = {},
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

/**
 * 429 Too Many Requests — backend `rateLimit` middleware emits envelope
 * `code: 'rate-limited'` plus a `Retry-After` header. The api-client maps
 * the envelope to this typed error so React Query handlers can branch on
 * `err instanceof RateLimitError` and `getUserFriendlyMessage` can render
 * an actionable copy ("You're going too fast. Try again in a moment.")
 * instead of the generic 5xx fallback.
 */
export class RateLimitError extends AppError {
  readonly retryAfterSeconds?: number;

  constructor(
    message = 'Too many requests',
    options: Omit<AppErrorOptions, 'code'> & { retryAfterSeconds?: number } = {},
  ) {
    super(message, {
      ...options,
      code: ErrorCode.SERVICE_UNAVAILABLE,
      statusCode: 429,
      isRetryable: true,
    });
    this.name = 'RateLimitError';
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

// =============================================================================
// Re-exports from new canonical location (δ phase 2 — auth-9.5+)
//
// `parseError`, `isAuthError`, and `getUserFriendlyMessage` moved to
// `@/auth/errors`. The shim below preserves the legacy import path so
// external consumers keep working without churn. `AuthError` is declared
// LOCALLY above (next to its base `AppError`) because moving the class
// declaration to `@/auth/errors` would create a top-level module-eval cycle
// (TDZ on `AppError`); see the JSDoc on `AuthError` for the longer note.
// =============================================================================

export { parseError, isAuthError, getUserFriendlyMessage } from '@/auth/errors';

// Internal import for use by isRetryableError / getQueryRetryCount below.
import { parseError as _parseError, isAuthError as _isAuthError } from '@/auth/errors';

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const appError = _parseError(error);
  return appError.isRetryable;
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
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: AppError;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = _parseError(error);

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
  const appError = _parseError(error);

  // Never retry auth errors
  if (_isAuthError(error)) {
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
