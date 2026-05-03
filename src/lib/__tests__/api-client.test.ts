import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// QA-M1 — this spec is the reference implementation for the MSW pattern.
// Previously we monkey-patched `globalThis.fetch` with `vi.fn()` and hand-
// rolled Response envelopes. MSW lets us assert the same contracts while
// running real `fetch` so header propagation, AbortController plumbing and
// timeouts all exercise production code paths.
//
// Pattern recap:
//   - Global handlers live in `tests/mocks/handlers.ts`.
//   - Per-spec overrides go through `server.use(http.X(...))` below and
//     are auto-reset in `afterEach` by the shared setup file.
// ---------------------------------------------------------------------------

import { server } from '../../../tests/mocks/server';

// App Check still needs to be mocked — it reaches into Firebase at module
// load. MSW only intercepts HTTP; module-level side effects are a
// different problem.
vi.mock('../app-check', () => ({
  getAppCheckToken: vi.fn(async () => 'app-check-token-xyz'),
  initAppCheck: vi.fn(() => null),
}));

vi.mock('../logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { apiClient, setIdTokenProvider } from '../api-client';
import { ApiError, ApiTimeoutError } from '../api-errors';

describe('apiClient', () => {
  beforeEach(() => {
    setIdTokenProvider(null);
  });

  afterEach(() => {
    setIdTokenProvider(null);
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Success path
  // ---------------------------------------------------------------------------

  it('unwraps the ApiResponse envelope on success', async () => {
    let capturedAppCheckHeader: string | null = null;
    server.use(
      http.get('*/api/v1/spas/42', ({ request }) => {
        capturedAppCheckHeader = request.headers.get('x-firebase-appcheck');
        return HttpResponse.json({
          success: true,
          data: { id: '42' },
          error: null,
        });
      }),
    );

    const data = await apiClient.get<{ id: string }>('/spas/42');

    expect(data).toEqual({ id: '42' });
    expect(capturedAppCheckHeader).toBe('app-check-token-xyz');
  });

  // ---------------------------------------------------------------------------
  // Envelope failure (success === false)
  // ---------------------------------------------------------------------------

  it('throws a typed ApiError when the envelope reports failure', async () => {
    server.use(
      http.get('*/api/v1/spas/missing', () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: 'not found',
            code: 'not-found',
            requestId: 'req-1',
          },
          { status: 200 },
        ),
      ),
    );

    await expect(apiClient.get('/spas/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      code: 'not-found',
      requestId: 'req-1',
      message: 'not found',
    });
  });

  it('throws ApiError on non-2xx responses', async () => {
    server.use(
      http.get('*/api/v1/spas', () =>
        HttpResponse.json({ success: false, error: 'boom', code: 'internal' }, { status: 500 }),
      ),
    );

    const err = await apiClient.get('/spas').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).code).toBe('internal');
  });

  // ---------------------------------------------------------------------------
  // 401 + token-expired → refresh + retry once
  // ---------------------------------------------------------------------------

  it('refreshes token and retries once when 401 token-expired is returned', async () => {
    const tokenProvider = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');
    setIdTokenProvider(tokenProvider);

    let call = 0;
    const authHeaders: string[] = [];
    server.use(
      http.get('*/api/v1/bookings', ({ request }) => {
        call += 1;
        authHeaders.push(request.headers.get('authorization') ?? '');
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

    const result = await apiClient.get<{ ok: boolean }>('/bookings');

    expect(result).toEqual({ ok: true });
    expect(call).toBe(2);
    expect(tokenProvider).toHaveBeenCalledTimes(2);
    // Second call MUST force-refresh.
    expect(tokenProvider.mock.calls[1]?.[0]).toBe(true);
    expect(authHeaders[1]).toBe('Bearer fresh-token');
  });

  it('does NOT retry 401 when envelope code is not token-expired', async () => {
    const tokenProvider = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockResolvedValue('t');
    setIdTokenProvider(tokenProvider);

    let call = 0;
    server.use(
      http.get('*/api/v1/bookings', () => {
        call += 1;
        return HttpResponse.json(
          { success: false, error: 'unauthorized', code: 'unauthorized' },
          { status: 401 },
        );
      }),
    );

    await expect(apiClient.get('/bookings')).rejects.toBeInstanceOf(ApiError);
    expect(call).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Timeout / abort
  // ---------------------------------------------------------------------------

  it('aborts with ApiTimeoutError when the request exceeds the timeout', async () => {
    vi.useFakeTimers();
    // MSW cannot model an infinite hang cleanly, so fall back to a
    // `fetch` stub for this single case — it's the only path that needs
    // AbortSignal semantics, which MSW does not expose from a handler.
    const fetchStub = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const onAbort = () => {
          reject(new DOMException('Aborted', 'AbortError'));
        };
        if (init?.signal?.aborted) {
          onAbort();
        } else {
          init?.signal?.addEventListener('abort', onAbort, { once: true });
        }
      }).catch((err) => {
        throw err;
      }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    try {
      const promise = apiClient.get('/slow', { timeout: 50 });
      const assertion = expect(promise).rejects.toBeInstanceOf(ApiTimeoutError);
      await vi.advanceTimersByTimeAsync(60);
      await assertion;
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ---------------------------------------------------------------------------
  // App Check header propagation
  // ---------------------------------------------------------------------------

  it('attaches X-Firebase-AppCheck header from the app-check module', async () => {
    const captured: Record<string, string | null> = {};
    server.use(
      http.post('*/api/v1/reviews', ({ request }) => {
        captured.appCheck = request.headers.get('x-firebase-appcheck');
        captured.contentType = request.headers.get('content-type');
        return HttpResponse.json({
          success: true,
          data: null,
          error: null,
        });
      }),
    );

    await apiClient.post('/reviews', { rating: 5 });

    expect(captured.appCheck).toBe('app-check-token-xyz');
    expect(captured.contentType).toBe('application/json');
  });
});
