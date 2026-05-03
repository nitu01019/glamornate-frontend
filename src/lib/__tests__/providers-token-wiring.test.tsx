/**
 * A1.1 — Token-wiring guard.
 *
 * The api-client only attaches `Authorization: Bearer <id-token>` if
 * `setIdTokenProvider(...)` has been called with a real provider. The bug
 * we're guarding against: forgetting to wire that call from `providers.tsx`,
 * which causes silent 401s on every authenticated request.
 *
 * These tests are deliberately framework-free — they exercise the api-client
 * directly so we can lock down the contract without standing up the full
 * provider tree.
 *
 *   Test 1: when NO provider has been registered, `apiClient.get(...)` must
 *           NOT send an `Authorization` header. (negative case)
 *
 *   Test 2: when a provider IS registered (mirroring what
 *           `providers.tsx` now does), `apiClient.get(...)` must send
 *           `Authorization: Bearer <token>`. (positive case)
 *
 * If either invariant ever flips, this test fails and the fix in
 * `providers.tsx` is what to look at.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// App Check reaches into Firebase at module load — silence it the same way
// `api-client.test.ts` does so this spec is hermetic.
vi.mock('../app-check', () => ({
  getAppCheckToken: vi.fn(async () => null),
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

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function installFetchSpy(): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;

  const spy: typeof fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: typeof input === 'string' ? input : input.toString(),
      init,
    });
    return new Response(
      JSON.stringify({ success: true, data: null, error: null }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as unknown as typeof fetch;

  globalThis.fetch = spy;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function readAuthHeader(init: RequestInit | undefined): string | undefined {
  const headers = init?.headers;
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    return headers.get('Authorization') ?? undefined;
  }
  if (Array.isArray(headers)) {
    const found = headers.find(([k]) => k.toLowerCase() === 'authorization');
    return found?.[1];
  }
  const obj = headers as Record<string, string>;
  return obj.Authorization ?? obj.authorization;
}

describe('providers — id-token wiring (A1.1 guard)', () => {
  beforeEach(() => {
    setIdTokenProvider(null);
  });

  afterEach(() => {
    setIdTokenProvider(null);
  });

  it('omits Authorization when setIdTokenProvider has not been called', async () => {
    const { calls, restore } = installFetchSpy();
    try {
      await apiClient.get('/whatever');
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    const auth = readAuthHeader(calls[0]?.init);
    expect(auth).toBeUndefined();
  });

  it('sends Authorization: Bearer <token> after setIdTokenProvider has been wired', async () => {
    setIdTokenProvider(async () => 'test-token');

    const { calls, restore } = installFetchSpy();
    try {
      await apiClient.get('/whatever');
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    const auth = readAuthHeader(calls[0]?.init);
    expect(auth).toBe('Bearer test-token');
  });
});
