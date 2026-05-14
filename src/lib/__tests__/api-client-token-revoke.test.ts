/**
 * Patch 4 — api-client terminal-code → onTokenRevoked wiring.
 *
 * Guards the branch added at `src/lib/api-client.ts:235-248`:
 *
 *     if (!skipAuth && idTokenProvider) {
 *       try {
 *         const token = await idTokenProvider(forceTokenRefresh);  // L223
 *         ...
 *       } catch (error) {
 *         apiLogger.warn('Failed to read Firebase id token', { error });
 *         const code = (error as { code?: string } | null)?.code;
 *         const isTerminal =
 *           forceTokenRefresh === true &&
 *           (code === 'auth/user-token-expired' ||
 *            code === 'auth/user-disabled' ||
 *            code === 'auth/invalid-user-token' ||
 *            code === 'auth/network-request-failed');
 *         if (isTerminal && onTokenRevoked) {
 *           try {
 *             onTokenRevoked();                                    // L244
 *           } catch (handlerError) {
 *             apiLogger.error('onTokenRevoked handler threw', ...); // L246
 *           }
 *         }
 *       }
 *     }
 *
 * The branch is gated by `forceTokenRefresh === true`, which is supplied to
 * `buildHeaders` as `attempt > 0` (see `src/lib/api-client.ts:273`). The only
 * production path that re-enters with `attempt = 1` is the 401-retry triggered
 * by an envelope `code: 'token-expired'` (`src/lib/api-client.ts:330-337`).
 * Each positive test therefore drives:
 *   - first response → 401 `token-expired` (causes the retry)
 *   - retry → `idTokenProvider(true)` throws with a terminal Firebase code
 *   - branch must invoke `onTokenRevoked` exactly once
 *
 * Negative tests cover:
 *   - non-terminal Firebase code (`auth/internal-error`) → handler NOT called
 *   - first-attempt failure (`forceTokenRefresh === false`)   → handler NOT called
 *   - provider resolves cleanly                                → handler NOT called
 *   - handler itself throws                                    → error swallowed
 *   - no handler registered (null)                             → no throw, no call
 *
 * Pattern lifted from `api-client.test.ts` and `providers-token-wiring.test.tsx`
 * (same `vi.mock('../app-check', …)` + `vi.mock('../logger', …)` shape, same
 * MSW `server.use(http.X(...))` override style).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '../../../tests/mocks/server';

// App Check touches Firebase at module load — stub it the same way the other
// api-client specs do so this test stays hermetic.
vi.mock('../app-check', () => ({
  getAppCheckToken: vi.fn(async () => null),
  initAppCheck: vi.fn(() => null),
}));

// Capture logger calls so we can assert L234 warn (`'Failed to read Firebase
// id token'`) and L246 error (`'onTokenRevoked handler threw'`). `vi.hoisted`
// is required because Vitest hoists `vi.mock` above local consts; without it
// the factory closure captures a TDZ reference.
const loggerCalls = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: {
    child: () => loggerCalls,
  },
}));

import { apiClient, setIdTokenProvider, setOnTokenRevoked } from '../api-client';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Construct a Firebase-style error with a `.code` property. Mirrors what
 * `firebase/auth`'s `getIdToken(true)` throws when the user's session is
 * terminal.
 */
function firebaseError(code: string): Error & { code: string } {
  const err = new Error(`Firebase: ${code}`) as Error & { code: string };
  err.code = code;
  return err;
}

/**
 * Install an MSW handler that returns 401 + `code: 'token-expired'` on the
 * first hit (forces the retry path) and 200 on the second hit. This is the
 * only production path that reaches `buildHeaders` with `attempt > 0` and
 * therefore `forceTokenRefresh === true` (`src/lib/api-client.ts:273`).
 *
 * Returns a counter so tests can assert exactly two requests were made.
 */
function install401ThenOkHandler(path: string): { calls: () => number } {
  let call = 0;
  server.use(
    http.get(`*/api/v1${path}`, () => {
      call += 1;
      if (call === 1) {
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: 'token expired',
            code: 'token-expired',
          },
          { status: 401 },
        );
      }
      return HttpResponse.json({
        success: true,
        data: { ok: true },
        error: null,
      });
    }),
  );
  return { calls: () => call };
}

// -----------------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------------

describe('apiClient — Patch 4 terminal-code → onTokenRevoked wiring', () => {
  beforeEach(() => {
    setIdTokenProvider(null);
    setOnTokenRevoked(null);
    loggerCalls.warn.mockClear();
    loggerCalls.error.mockClear();
    loggerCalls.info.mockClear();
    loggerCalls.debug.mockClear();
  });

  afterEach(() => {
    setIdTokenProvider(null);
    setOnTokenRevoked(null);
  });

  // ---------------------------------------------------------------------------
  // Positive cases — each terminal Firebase code at api-client.ts:238-241
  // MUST trigger onTokenRevoked exactly once.
  // ---------------------------------------------------------------------------

  it.each([
    ['auth/user-token-expired'],
    ['auth/user-disabled'],
    ['auth/invalid-user-token'],
    ['auth/network-request-failed'],
  ])(
    'invokes onTokenRevoked exactly once when getIdToken(true) throws %s',
    async (terminalCode) => {
      const handler = vi.fn();
      setOnTokenRevoked(handler);

      // First call (attempt=0, forceRefresh=false) → stale token.
      // Second call (attempt=1, forceRefresh=true)  → throws terminal code.
      const provider = vi
        .fn<(forceRefresh?: boolean) => Promise<string | null>>()
        .mockResolvedValueOnce('stale-token')
        .mockRejectedValueOnce(firebaseError(terminalCode));
      setIdTokenProvider(provider);

      const { calls } = install401ThenOkHandler('/bookings');

      // The retry's request proceeds without an Authorization header (the
      // catch at L225 swallows so request continues unauth) and the MSW
      // handler returns 200, so the outer call resolves cleanly.
      await apiClient.get('/bookings');

      // Provider invoked twice — once unforced, once forced.
      expect(provider).toHaveBeenCalledTimes(2);
      expect(provider.mock.calls[0]?.[0]).toBe(false); // attempt=0 path
      expect(provider.mock.calls[1]?.[0]).toBe(true); //  attempt=1 path

      // Branch at api-client.ts:242-247 fired exactly once.
      expect(handler).toHaveBeenCalledTimes(1);

      // The catch at api-client.ts:234 always emits a warn — verifies we
      // actually entered the catch (and didn't pass via some other path).
      expect(loggerCalls.warn).toHaveBeenCalledWith(
        'Failed to read Firebase id token',
        expect.objectContaining({ error: expect.objectContaining({ code: terminalCode }) }),
      );

      // Retry path was taken: two outbound HTTP requests.
      expect(calls()).toBe(2);
    },
  );

  // ---------------------------------------------------------------------------
  // Negative — non-terminal Firebase code → handler must NOT fire.
  // Tests the `isTerminal` falsey branch at api-client.ts:236-241.
  // ---------------------------------------------------------------------------

  it('does NOT invoke onTokenRevoked when getIdToken(true) throws a non-terminal code', async () => {
    const handler = vi.fn();
    setOnTokenRevoked(handler);

    const provider = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockResolvedValueOnce('stale-token')
      .mockRejectedValueOnce(firebaseError('auth/internal-error'));
    setIdTokenProvider(provider);

    install401ThenOkHandler('/bookings');

    await apiClient.get('/bookings');

    expect(provider).toHaveBeenCalledTimes(2);
    expect(handler).not.toHaveBeenCalled();
    // The warn at L234 still fires — confirms we did enter the catch.
    expect(loggerCalls.warn).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Negative — force=false path. The branch is gated on
  // `forceTokenRefresh === true` (api-client.ts:237), so a throw on the
  // initial attempt (attempt=0) must NOT call onTokenRevoked.
  // ---------------------------------------------------------------------------

  it('does NOT invoke onTokenRevoked when getIdToken(false) throws a terminal code', async () => {
    const handler = vi.fn();
    setOnTokenRevoked(handler);

    // Provider throws on the very first call — attempt=0 → forceRefresh=false.
    const provider = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockRejectedValueOnce(firebaseError('auth/user-token-expired'));
    setIdTokenProvider(provider);

    // The catch swallows so the request proceeds unauth — return a happy
    // envelope so the assertion target is the handler call count, not the
    // outer promise.
    server.use(
      http.get('*/api/v1/bookings', () =>
        HttpResponse.json({ success: true, data: { ok: true }, error: null }),
      ),
    );

    await apiClient.get('/bookings');

    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0]?.[0]).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Negative — provider succeeds. Catch at L225 never runs, so the branch
  // cannot fire.
  // ---------------------------------------------------------------------------

  it('does NOT invoke onTokenRevoked when getIdToken resolves successfully', async () => {
    const handler = vi.fn();
    setOnTokenRevoked(handler);

    const provider = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockResolvedValue('token');
    setIdTokenProvider(provider);

    server.use(
      http.get('*/api/v1/bookings', () =>
        HttpResponse.json({ success: true, data: { ok: true }, error: null }),
      ),
    );

    await apiClient.get('/bookings');

    expect(handler).not.toHaveBeenCalled();
    // Catch at L225 never entered → no warn.
    expect(loggerCalls.warn).not.toHaveBeenCalledWith(
      'Failed to read Firebase id token',
      expect.anything(),
    );
  });

  // ---------------------------------------------------------------------------
  // Resilience — handler throws.
  // The inner try/catch at api-client.ts:243-247 must swallow handler errors
  // and emit `apiLogger.error('onTokenRevoked handler threw', …)` (L246).
  // The outer api-client call MUST still resolve.
  // ---------------------------------------------------------------------------

  it('swallows errors thrown by the onTokenRevoked handler (does NOT bubble)', async () => {
    const boom = new Error('handler exploded');
    const handler = vi.fn(() => {
      throw boom;
    });
    setOnTokenRevoked(handler);

    const provider = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockResolvedValueOnce('stale-token')
      .mockRejectedValueOnce(firebaseError('auth/user-token-expired'));
    setIdTokenProvider(provider);

    install401ThenOkHandler('/bookings');

    // No throw — outer call resolves even though the handler exploded.
    await expect(apiClient.get('/bookings')).resolves.toEqual({ ok: true });

    expect(handler).toHaveBeenCalledTimes(1);
    // L246 error log fired with the handler error as the payload.
    expect(loggerCalls.error).toHaveBeenCalledWith('onTokenRevoked handler threw', boom);
  });

  // ---------------------------------------------------------------------------
  // Handler-not-registered — `onTokenRevoked` is `null` (default state).
  // The branch at api-client.ts:242 short-circuits on the truthy check; no
  // throw, no error log.
  // ---------------------------------------------------------------------------

  it('does not throw when onTokenRevoked is null (never registered)', async () => {
    // Explicit — beforeEach already nulls it, but assert the contract.
    setOnTokenRevoked(null);

    const provider = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockResolvedValueOnce('stale-token')
      .mockRejectedValueOnce(firebaseError('auth/user-disabled'));
    setIdTokenProvider(provider);

    install401ThenOkHandler('/bookings');

    await expect(apiClient.get('/bookings')).resolves.toEqual({ ok: true });

    // L234 warn ran (we entered the catch) but L246 error did NOT (the
    // handler short-circuit at L242 stopped before the inner try).
    expect(loggerCalls.warn).toHaveBeenCalled();
    expect(loggerCalls.error).not.toHaveBeenCalledWith(
      'onTokenRevoked handler threw',
      expect.anything(),
    );
  });
});
