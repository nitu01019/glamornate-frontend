/**
 * API error types emitted by `api-client.ts`.
 *
 * `ApiError` is the single typed error surface for the new `apiClient`. It
 * normalizes both HTTP-level failures (non-2xx responses) and envelope-level
 * failures (`success === false` in a 2xx body) into a single shape so that
 * React Query `onError` handlers and UI error boundaries can branch on a
 * consistent structure.
 */
import type { AuthErrorCodeT } from '@/auth/error-codes';

/**
 * Typed error thrown by `apiClient` for every non-successful API response.
 *
 * The error always carries the HTTP `status` and, when available, the backend
 * `code` from the response envelope. Consumers should narrow on `code` rather
 * than parsing the message string.
 */
export class ApiError extends Error {
  /** HTTP status code. `0` for network-level failures (fetch threw). */
  readonly status: number;
  /** Machine-readable error code from the envelope (e.g. `token-expired`). */
  readonly code?: string;
  /** Correlation id echoed from the backend, for support tickets. */
  readonly requestId?: string;
  /** Raw JSON body of the response (when parseable), for debugging. */
  readonly body?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      requestId?: string;
      body?: unknown;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.body = options.body;

    // Preserve original error for debugging without coupling to ES2022 cause.
    if (options.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = options.cause;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /** Convenience: true when the response indicates an expired Firebase id token. */
  get isTokenExpired(): boolean {
    const EXPIRED: AuthErrorCodeT = 'token-expired';
    return this.status === 401 && this.code === EXPIRED;
  }

  /** Convenience: true when the server aborted due to client-side timeout. */
  get isTimeout(): boolean {
    return this.code === 'timeout' || this.name === 'TimeoutError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      requestId: this.requestId,
      body: this.body,
    };
  }
}

/**
 * Error thrown when a request is aborted due to the client-side timeout
 * controller firing. Inherits from `ApiError` so that error handlers can use
 * the same narrowing surface.
 */
export class ApiTimeoutError extends ApiError {
  constructor(message = 'Request timed out', cause?: unknown) {
    super(message, { status: 0, code: 'timeout', cause });
    this.name = 'TimeoutError';
  }
}

/**
 * Type guard for `ApiError`.
 */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
