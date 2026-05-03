/**
 * QA-M1 — Test wrappers.
 *
 * `renderWithProviders` gives a spec a React Testing Library `render` that
 * already composes the safe-for-test providers (React Query, Toast).
 *
 * Providers intentionally EXCLUDED
 * --------------------------------
 *   - `AuthProvider` and `LocationProvider` — both reach for Firebase /
 *     browser geolocation on mount, which is noisy in jsdom. Specs that
 *     need auth state should mock `@/lib/auth-provider` directly or pass
 *     a stub via props.
 *   - Query persistence (`PersistQueryClientProvider`) — uses async
 *     storage and a cache buster that is irrelevant inside vitest.
 *
 * Usage
 * -----
 *   import { renderWithProviders } from '@/test/wrappers';
 *   renderWithProviders(<MyComponent />);
 *
 * Optional overrides
 * ------------------
 *   - `queryClient`: pass a pre-seeded `QueryClient` to share state across
 *     multiple `renderHook` / `render` calls in one test.
 */

import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Optional pre-configured QueryClient. Useful when a test needs to seed
   * cache data before render or share a client between multiple renders.
   */
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

/**
 * Create a fresh QueryClient tuned for tests:
 *   - retries disabled so errors surface immediately
 *   - gcTime/staleTime zero so cache state is deterministic
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return { ...result, queryClient };
}
