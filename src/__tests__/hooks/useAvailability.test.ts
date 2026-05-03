/**
 * Phase 3 (Booking Flow Fix v3.1, 2026-05-02): regression test pinning the
 * wire-contract field name `serviceDuration` on `useAvailableSlots`. The
 * legacy implementation sent `duration`, which the backend silently
 * defaulted to 30 — shrinking multi-service slot windows and surfacing as
 * generic SLOT_UNAVAILABLE toasts (Issue B).
 *
 * The single assertion below pins the payload key the hook forwards to
 * the `getAvailableSlots` callable. Anything other than `serviceDuration`
 * means the wire contract drifted again.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// firebase mock — `useAvailableSlots` short-circuits to `slots: []` when
// `isFirebaseConfigured()` is false, so we must return true here.
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: () => true,
  getFirestoreDb: () => ({ __mock: 'firestore' }),
}));

// ---------------------------------------------------------------------------
// firebase-client-wrapper mock — capture the callFunction payload.
// ---------------------------------------------------------------------------

const callFunctionSpy = vi.fn();

vi.mock('@/lib/firebase-client-wrapper', () => ({
  firebaseClientWrapper: {
    callFunction: (...args: unknown[]) => callFunctionSpy(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useAvailableSlots } from '@/hooks/useAvailability';

// ---------------------------------------------------------------------------
// QueryClientProvider wrapper
// ---------------------------------------------------------------------------

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  callFunctionSpy.mockReset();
  callFunctionSpy.mockResolvedValue({ date: '2026-05-02', slots: [] });
});

describe('useAvailableSlots — wire contract', () => {
  it('forwards the duration on the `serviceDuration` payload key (NOT `duration`)', async () => {
    const { result } = renderHook(
      () =>
        useAvailableSlots({
          spaId: 'spa-1',
          date: '2026-05-02',
          serviceDuration: 60,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(callFunctionSpy).toHaveBeenCalledTimes(1);
    const [functionName, payload] = callFunctionSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(functionName).toBe('getAvailableSlots');
    expect(payload).toHaveProperty('serviceDuration', 60);
    expect(payload).not.toHaveProperty('duration');
  });
});
