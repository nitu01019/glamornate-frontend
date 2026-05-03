/**
 * Unified API client for the Glamornate frontend.
 *
 * Plan §R1, §R5, §R6/N1, §R6/N6 acceptance criteria:
 *   - Single source of truth for HTTP calls from the web/mobile frontend.
 *   - Base URL is read from `NEXT_PUBLIC_API_BASE_URL` at module init; an
 *     empty / missing value defaults to `/api/v1` (web SSR via Next routes).
 *   - `Authorization: Bearer <idToken>` is attached automatically on every
 *     request when the app has provided a token getter via
 *     `setIdTokenProvider`.
 *   - `X-Firebase-AppCheck` is attached when a token is available.
 *   - 15s default timeout via `AbortController`; callers may override.
 *   - On `401` with envelope `code === 'token-expired'` the client calls
 *     `getIdToken(true)` to force-refresh the token and retries ONCE.
 *   - All non-successful responses throw a typed `ApiError` so React Query
 *     handlers can narrow on `err.status` / `err.code` / `err.isTokenExpired`.
 *
 * The client is intentionally framework-free (no React, no Next) so it can be
 * used from hooks, server components, and Capacitor contexts.
 */

import * as Sentry from '@sentry/nextjs';
import { ApiError, ApiTimeoutError } from './api-errors';
import { getAppCheckToken } from './app-check';
import { logger } from './logger';
import type { ApiResponse, HttpMethod } from '@glamornate/contracts';
import { TOKEN_EXPIRED_CODE } from '@glamornate/contracts';

const apiLogger = logger.child({ component: 'apiClient' });

// Dedupe App Check breadcrumbs: emit at most once per session per route.
const _appCheckMissingRoutes = new Set<string>();

// =============================================================================
// Module configuration
// =============================================================================

const DEFAULT_BASE_URL = '/api/v1';
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Resolve the base URL once at module init. An empty string OR missing env
 * var both fall back to the same `/api/v1` default — this keeps the web-dev
 * and Vercel cases identical without extra config.
 */
function resolveBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const trimmed = raw.trim();
  if (trimmed === '') return DEFAULT_BASE_URL;
  // Strip trailing slash to keep concatenation predictable.
  return trimmed.replace(/\/$/, '');
}

const BASE_URL = resolveBaseUrl();

/**
 * Firebase id-token provider. Set via `setIdTokenProvider()` from
 * `auth-provider.tsx` / `providers.tsx` once the auth SDK is ready. Left as
 * `null` during tests and SSR so the client works without Firebase.
 */
export type IdTokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

let idTokenProvider: IdTokenProvider | null = null;

/**
 * Inject the Firebase auth `getIdToken` function. Called once from the auth
 * provider after the Firebase SDK is initialized. Passing `null` clears it
 * (used in tests).
 */
export function setIdTokenProvider(provider: IdTokenProvider | null): void {
  idTokenProvider = provider;
}

// =============================================================================
// Request option types
// =============================================================================

export interface ApiRequestOptions {
  /** Query string parameters. Undefined values are skipped. */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** Additional request headers merged on top of the defaults. */
  headers?: Record<string, string>;
  /** Skip attaching `Authorization` even when a token is available. */
  skipAuth?: boolean;
  /** Per-request timeout in milliseconds. Defaults to 15s. */
  timeout?: number;
  /** Caller-supplied AbortSignal; composes with the timeout controller. */
  signal?: AbortSignal;
  /**
   * When `true`, the client returns the parsed response body as-is instead of
   * unwrapping the `ApiResponse` envelope. Useful for endpoints that expose
   * envelope-level metadata (e.g. `fallbackLevel` on home feeds) that would
   * otherwise be dropped.
   */
  raw?: boolean;
}

// =============================================================================
// Internal helpers
// =============================================================================

function joinPath(base: string, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

function buildUrl(
  path: string,
  params?: ApiRequestOptions['params'],
): string {
  const url = joinPath(BASE_URL, path);
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  if (!qs) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${qs}`;
}

function composeAbortSignal(
  timeoutMs: number,
  external?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);

  let externalListener: (() => void) | null = null;
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    externalListener = () => controller.abort(external.reason);
    external.addEventListener('abort', externalListener);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (external && externalListener) {
        external.removeEventListener('abort', externalListener);
      }
    },
  };
}

/**
 * Parse a response body once. Returns `undefined` when there is no body or
 * the body is not JSON — callers treat that as `null` data.
 */
async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function envelopeFrom(body: unknown): Partial<ApiResponse<unknown>> {
  if (body && typeof body === 'object') {
    return body as Partial<ApiResponse<unknown>>;
  }
  return {};
}

function toApiError(
  response: Response,
  body: unknown,
  fallbackMessage: string,
): ApiError {
  const envelope = envelopeFrom(body);
  return new ApiError(envelope.error ?? fallbackMessage, {
    status: response.status,
    code: envelope.code,
    requestId: envelope.requestId,
    body,
  });
}

// =============================================================================
// Core request pipeline
// =============================================================================

async function buildHeaders(
  method: HttpMethod,
  skipAuth: boolean,
  extra: Record<string, string> | undefined,
  forceTokenRefresh: boolean,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(extra ?? {}),
  };

  const isMutation = method !== 'GET';
  if (isMutation && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth && idTokenProvider) {
    try {
      const token = await idTokenProvider(forceTokenRefresh);
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      apiLogger.warn('Failed to read Firebase id token', { error });
    }
  }

  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;

  return headers;
}

async function performRequest<T>(
  method: HttpMethod,
  path: string,
  body: unknown,
  options: ApiRequestOptions,
  attempt: number,
): Promise<T> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const url = buildUrl(path, options.params);

  const { signal, cleanup } = composeAbortSignal(timeout, options.signal);
  const headers = await buildHeaders(method, options.skipAuth ?? false, options.headers, attempt > 0);

  // Emit a one-shot Sentry breadcrumb when App Check is unavailable in
  // production — once per session per route to avoid spamming.
  if (
    process.env.NODE_ENV === 'production' &&
    !headers['X-Firebase-AppCheck'] &&
    !_appCheckMissingRoutes.has(path)
  ) {
    _appCheckMissingRoutes.add(path);
    Sentry.addBreadcrumb({
      category: 'app_check',
      message: 'token_unavailable',
      level: 'warning',
      data: { route: path },
    });
  }

  apiLogger.debug('apiClient request', { method, path, attempt });

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: 'include',
    });
  } catch (error) {
    cleanup();
    if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new ApiTimeoutError('Request timed out', error);
    }
    throw new ApiError('Network request failed', {
      status: 0,
      code: 'network-error',
      cause: error,
    });
  }
  cleanup();

  const parsed = await parseBody(response);

  // 401 + token-expired → refresh once, retry once.
  if (response.status === 401 && attempt === 0) {
    const envelope = envelopeFrom(parsed);
    const shouldRefresh =
      envelope.code === TOKEN_EXPIRED_CODE || envelope.error === TOKEN_EXPIRED_CODE;
    if (shouldRefresh && idTokenProvider && !options.skipAuth) {
      apiLogger.info('Received token-expired; forcing refresh and retrying once.', { path });
      return performRequest<T>(method, path, body, options, attempt + 1);
    }
  }

  if (!response.ok) {
    throw toApiError(response, parsed, `Request failed with status ${response.status}`);
  }

  // Success — unwrap the envelope unless the caller opted into raw mode.
  const envelope = envelopeFrom(parsed) as ApiResponse<T>;
  if (envelope.success === false) {
    throw toApiError(response, parsed, envelope.error ?? 'Request unsuccessful');
  }

  if (options.raw) {
    return (parsed ?? null) as T;
  }

  // Non-envelope body (e.g. raw JSON from a legacy route) — return as-is.
  if (envelope.success === undefined && parsed !== undefined) {
    return parsed as T;
  }

  return (envelope.data ?? null) as T;
}

// =============================================================================
// Public API
// =============================================================================

export interface ApiClient {
  get<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  delete<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  /** Exposed for tests / diagnostics. */
  readonly baseUrl: string;
}

export const apiClient: ApiClient = {
  get: <T>(path: string, options: ApiRequestOptions = {}) =>
    performRequest<T>('GET', path, undefined, options, 0),
  post: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    performRequest<T>('POST', path, body, options, 0),
  put: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    performRequest<T>('PUT', path, body, options, 0),
  patch: <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
    performRequest<T>('PATCH', path, body, options, 0),
  delete: <T>(path: string, options: ApiRequestOptions = {}) =>
    performRequest<T>('DELETE', path, undefined, options, 0),
  baseUrl: BASE_URL,
};

export type { ApiResponse } from '@glamornate/contracts';
export { ApiError, ApiTimeoutError, isApiError } from './api-errors';
