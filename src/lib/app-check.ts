/**
 * Firebase App Check initialization for the web client.
 *
 * Plan §R5: App Check enforces bot / abuse protection on every public
 * `/api/v1/*` endpoint. On the web we use the ReCaptcha v3 provider (Android
 * and iOS use Play Integrity / DeviceCheck, initialized inside Capacitor).
 *
 * Contract:
 *   - `initAppCheck()` is idempotent. Call it once from `providers.tsx`
 *     (Team D) on the client side.
 *   - When `NEXT_PUBLIC_APP_CHECK_DEBUG === 'true'`, a debug token is enabled
 *     BEFORE `initializeAppCheck` so Firebase picks it up.
 *   - `getAppCheckToken()` returns the latest token string or `null` when
 *     App Check is not initialized / unavailable. `api-client.ts` uses it to
 *     set the `X-Firebase-AppCheck` header.
 */

import { getApp, FirebaseApp } from 'firebase/app';
import {
  AppCheck,
  getToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
  CustomProvider,
} from 'firebase/app-check';
import { FirebaseAppCheck } from '@capacitor-firebase/app-check';

import { isNative } from './capacitor';
import { logger } from './logger';

const appCheckLogger = logger.child({ component: 'AppCheck' });

let appCheckInstance: AppCheck | null = null;
let initialized = false;

// ---------------------------------------------------------------------------
// Typed error surface
// ---------------------------------------------------------------------------

export type AppCheckErrorKind =
  | 'native_provider_failed'
  | 'network'
  | 'unsupported_device';

export class AppCheckTokenError extends Error {
  readonly kind: AppCheckErrorKind;
  readonly cause: unknown;

  constructor(kind: AppCheckErrorKind, cause: unknown) {
    super(`App Check token error: ${kind}`);
    this.name = 'AppCheckTokenError';
    this.kind = kind;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true for errors that may succeed on a retry (network / transient). */
function isRetryable(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  // Play Integrity unsupported or not enabled in Firebase Console → fail fast.
  if (
    msg.includes('unsupported') ||
    msg.includes('play integrity') ||
    msg.includes('not enabled') ||
    msg.includes('api not enabled')
  ) {
    return false;
  }
  // Network-class failures are worth one retry.
  return (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch')
  );
}

/** Single retry with a fixed 250 ms backoff. */
async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (firstError) {
    if (!isRetryable(firstError)) throw firstError;
    appCheckLogger.warn('App Check native getToken transient failure — retrying once', {
      retryCount: 1,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
    return fn();
  }
}

// ---------------------------------------------------------------------------
// Debug token helper
// ---------------------------------------------------------------------------

/**
 * Enable the Firebase App Check debug token on the `window` / `self` global.
 *
 * MUST run before `initializeAppCheck`. Two modes per the Firebase SDK contract:
 *
 *   1. `FIREBASE_APPCHECK_DEBUG_TOKEN = "<uuid>"` (string): the SDK uses that
 *      exact token. The developer registers the SAME UUID once in Firebase
 *      Console → App Check → Apps → Manage debug tokens, and every page load
 *      thereafter is recognized. This is the production-of-dev pattern: a
 *      stable, version-controlled token (`NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN`
 *      in `.env.local`).
 *
 *   2. `FIREBASE_APPCHECK_DEBUG_TOKEN = true` (boolean): the SDK generates a
 *      random UUID, prints it to the browser console once, and uses it for
 *      that page's lifetime. The developer must copy that fresh UUID into the
 *      console allowlist on every regeneration. Used as a last-resort fallback
 *      when no env-supplied token is configured.
 */
function enableDebugTokenIfRequested(): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof self === 'undefined') return;
  if (process.env.NEXT_PUBLIC_APP_CHECK_DEBUG !== 'true') return;

  const envToken = process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN?.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `FIREBASE_APPCHECK_DEBUG_TOKEN` is an undocumented Firebase SDK global with no exported type; cast is the documented contract per firebase-js-sdk App Check docs
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = envToken && envToken.length > 0 ? envToken : true;

  if (envToken && envToken.length > 0) {
    appCheckLogger.info(
      'App Check debug mode using stable token from NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN — ensure it is registered in Firebase Console → App Check → Apps → Manage debug tokens.',
    );
  } else {
    appCheckLogger.info(
      'App Check debug mode enabled with auto-generated token — copy the UUID Firebase prints in the console and register it for stability across reloads.',
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize App Check exactly once on the client. No-op on the server and on
 * subsequent calls. Returns the `AppCheck` instance on success or `null` if
 * initialization is skipped (missing site key, SSR, already initialized).
 */
export function initAppCheck(app?: FirebaseApp): AppCheck | null {
  if (typeof window === 'undefined') return null;
  if (initialized) return appCheckInstance;

  // M-APPCHECK-WIRE: On Capacitor native (Android/iOS), use the Capacitor
  // Firebase App Check plugin as a CustomProvider so the JS SDK's
  // `appCheckInstance` is properly initialized and tokens are forwarded in
  // every `X-Firebase-AppCheck` header. The Capacitor plugin bridges to the
  // native Play Integrity / DeviceCheck attestation; the JS SDK handles token
  // caching and auto-refresh via `isTokenAutoRefreshEnabled`.
  if (isNative()) {
    try {
      appCheckLogger.info('app-check.expectedNativeProvider', {
        provider: process.env.NEXT_PUBLIC_APP_CHECK_EXPECTED_PROVIDER ?? 'debug',
      });
      const firebaseApp = app ?? getApp();
      appCheckInstance = initializeAppCheck(firebaseApp, {
        provider: new CustomProvider({
          getToken: async () => {
            let result: Awaited<ReturnType<typeof FirebaseAppCheck.getToken>>;
            try {
              result = await withOneRetry(() => FirebaseAppCheck.getToken({}));
            } catch (error) {
              const kind: AppCheckErrorKind = isRetryable(error)
                ? 'network'
                : (error instanceof Error &&
                    (error.message.toLowerCase().includes('unsupported') ||
                      error.message.toLowerCase().includes('play integrity')))
                  ? 'unsupported_device'
                  : 'native_provider_failed';
              appCheckLogger.error('App Check native getToken failed', error, { kind });
              throw new AppCheckTokenError(kind, error);
            }

            // expireTimeMillis is wall-clock epoch ms per the Capacitor plugin
            // docs ("milliseconds since epoch") — safe to compare with Date.now().
            // Fallback extends 1 hour from now when the native bridge omits it
            // (web-only path or older plugin versions).
            const expireTimeMillis = result.expireTimeMillis ?? Date.now() + 60 * 60 * 1000;
            appCheckLogger.info('app-check.native.initialized', {
              provider: 'CustomProvider',
              expireMs: expireTimeMillis,
            });
            return { token: result.token, expireTimeMillis };
          },
        }),
        isTokenAutoRefreshEnabled: true,
      });
      initialized = true;
      return appCheckInstance;
    } catch (error) {
      appCheckLogger.error('Failed to initialize App Check on native', error);
      initialized = true;
      return null;
    }
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    appCheckLogger.warn(
      'NEXT_PUBLIC_RECAPTCHA_SITE_KEY missing — App Check will not be initialized. API calls will be rejected in enforced mode.',
    );
    initialized = true;
    return null;
  }

  enableDebugTokenIfRequested();

  try {
    const firebaseApp = app ?? getApp();
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    initialized = true;
    appCheckLogger.info('App Check initialized with ReCaptcha v3.');
    return appCheckInstance;
  } catch (error) {
    appCheckLogger.error('Failed to initialize App Check', error);
    initialized = true;
    return null;
  }
}

/**
 * Fetch the current App Check token, or `null` if App Check is not active.
 * Called by `api-client.ts` on every request to set the
 * `X-Firebase-AppCheck` header. Swallows all errors so that App Check
 * failures never block an API request on the client — the backend will
 * reject if the header is required.
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheckInstance) return null;

  try {
    const result = await getToken(appCheckInstance, /* forceRefresh */ false);
    return result.token;
  } catch (error) {
    appCheckLogger.warn('getAppCheckToken failed', { error });
    return null;
  }
}

/**
 * Force-refresh the App Check token, bypassing the SDK's in-memory cache.
 *
 * Used by the visibility-gated heartbeat below and by callers that just
 * received a `permission-denied` from a Firestore read and want to retry
 * with a freshly-minted token. Returns `null` on failure rather than
 * throwing — callers handle absence the same way as `getAppCheckToken`.
 *
 * Plan §Phase 8.
 */
export async function refreshAppCheckToken(): Promise<string | null> {
  if (!appCheckInstance) return null;
  try {
    const result = await getToken(appCheckInstance, /* forceRefresh */ true);
    return result.token;
  } catch (error) {
    appCheckLogger.warn('refreshAppCheckToken failed', { error });
    return null;
  }
}

/**
 * 45-minute heartbeat that proactively refreshes the App Check token while
 * the tab is visible. Pre-empts the 60-minute Play Integrity / ReCaptcha
 * expiry so a long-idle session doesn't surface a `permission-denied` on
 * the next Firestore read.
 *
 * Visibility-gated: when the tab is hidden we pause the timer and resume
 * (with an immediate refresh) on the next `visibilitychange → visible`.
 * Idempotent across multiple calls; returns a stop function.
 *
 * Plan §Phase 8.
 */
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;

const HEARTBEAT_INTERVAL_MS = 45 * 60 * 1000;

export function startAppCheckHeartbeat(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (heartbeatTimer) {
    return stopAppCheckHeartbeat;
  }

  const tick = () => {
    if (document.visibilityState !== 'visible') return;
    void refreshAppCheckToken();
  };

  heartbeatTimer = setInterval(tick, HEARTBEAT_INTERVAL_MS);

  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      void refreshAppCheckToken();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  appCheckLogger.info('App Check heartbeat started', {
    intervalMs: HEARTBEAT_INTERVAL_MS,
  });
  return stopAppCheckHeartbeat;
}

export function stopAppCheckHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

/**
 * Reset module state. Exposed for tests only.
 * @internal
 */
export function __resetAppCheckForTests(): void {
  stopAppCheckHeartbeat();
  appCheckInstance = null;
  initialized = false;
}
