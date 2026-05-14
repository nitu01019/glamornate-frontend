/**
 * β8 regression guard (δ5, 2026-05-12).
 *
 * Before β8 fix: `mutationCache.onError` in `lib/providers.tsx` had NO
 * `isAuthError` guard, while `queryCache.onError` did. Auth errors thrown
 * during mutations (e.g. a session-expired 401 on a booking submit) would
 * toast over the login page after the token-revoke seam redirected the user,
 * producing a confusing double-message.
 *
 * After β8 fix: both caches share the same guard — `!isAuthError(error)`.
 *
 * This test reproduces the MutationCache wiring from `createQueryClient`
 * directly (the function is internal to providers.tsx and not exported), so
 * we can drive a mutation failure and assert the `showErrorToast` callback
 * was NOT invoked when the error is an AuthError.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { AuthError, NetworkError, parseError, isAuthError, type AppError } from '../error-handler';

// Mirror the MutationCache configuration from `lib/providers.tsx:175-188`
// after the β8 fix. If the production file's logic ever drifts from this,
// updates here must mirror there.
function buildMutationCache(showErrorToast: (e: AppError) => void): MutationCache {
  return new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const appError = parseError(error);
      if (!mutation.meta?.skipErrorToast && !isAuthError(error)) {
        showErrorToast(appError);
      }
    },
  });
}

function makeQueryClient(mutationCache: MutationCache): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache,
    defaultOptions: {
      mutations: { retry: false },
    },
  });
}

describe('mutationCache onError β8 guard', () => {
  let showErrorToast: ReturnType<typeof vi.fn<(e: AppError) => void>>;
  let mutationCache: MutationCache;
  let client: QueryClient;

  beforeEach(() => {
    showErrorToast = vi.fn<(e: AppError) => void>();
    mutationCache = buildMutationCache(showErrorToast);
    client = makeQueryClient(mutationCache);
  });

  it('does NOT call showErrorToast when the mutation rejects with an AuthError (β8)', async () => {
    const authError = new AuthError('session expired', { firebaseCode: 'auth/session-expired' });

    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw authError;
          },
        })
        .execute(undefined),
    ).rejects.toBe(authError);

    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('does NOT call showErrorToast when the rejection is a 401 API envelope (auth via parseError)', async () => {
    const apiAuthError = { status: 401, message: 'token-expired' };

    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw apiAuthError;
          },
        })
        .execute(undefined),
    ).rejects.toBe(apiAuthError);

    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('DOES call showErrorToast for non-auth errors (sanity — guard is not over-broad)', async () => {
    const networkError = new NetworkError('boom');

    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw networkError;
          },
        })
        .execute(undefined),
    ).rejects.toBe(networkError);

    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(showErrorToast).toHaveBeenCalledWith(networkError);
  });

  it('respects meta.skipErrorToast even for non-auth errors', async () => {
    const networkError = new NetworkError('boom');

    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw networkError;
          },
          meta: { skipErrorToast: true },
        })
        .execute(undefined),
    ).rejects.toBe(networkError);

    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
