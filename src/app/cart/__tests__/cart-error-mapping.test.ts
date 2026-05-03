import { describe, expect, it } from 'vitest';

import { ApiError, ApiTimeoutError } from '@/lib/api-errors';
import {
  __testing,
  mapCartError,
  reportCartError,
  type CartErrorState,
} from '@/app/cart/cart-error-mapping';

function apiError(
  status: number,
  overrides: Partial<ConstructorParameters<typeof ApiError>[1]> = {},
) {
  return new ApiError(`status ${status}`, { status, ...overrides });
}

describe('mapCartError', () => {
  it('maps 401 to the sign-in banner variant with a return URL', () => {
    const state = mapCartError(apiError(401), '/cart');
    expect(state.variant).toBe('auth-required');
    expect(state.primaryCta?.href).toBe('/auth/login?next=%2Fcart');
    expect(state.secondaryCta).toBeNull();
    expect(state.status).toBe(401);
  });

  it('encodes a non-default nextPath in the sign-in CTA', () => {
    const state = mapCartError(apiError(401), '/customer/book-new?cartId=abc');
    expect(state.primaryCta?.href).toBe('/auth/login?next=%2Fcustomer%2Fbook-new%3FcartId%3Dabc');
  });

  it('maps 400 to the items-unavailable variant with a refresh CTA', () => {
    const state = mapCartError(apiError(400));
    expect(state.variant).toBe('items-unavailable');
    expect(state.primaryCta?.action).toBe('refresh');
  });

  it('maps 403 to the address-required variant with a deep-link', () => {
    const state = mapCartError(apiError(403));
    expect(state.variant).toBe('address-required');
    expect(state.primaryCta?.href).toBe('/customer/addresses?new=1');
  });

  it('maps 429 to the rate-limited variant with a cooldown and no CTA', () => {
    const state = mapCartError(apiError(429));
    expect(state.variant).toBe('rate-limited');
    expect(state.primaryCta).toBeNull();
    expect(state.cooldownMs).toBe(__testing.RATE_LIMIT_COOLDOWN_MS);
  });

  it.each([500, 502, 503, 504])('maps 5xx (%s) to the connection-issue variant', (status) => {
    const state = mapCartError(apiError(status));
    expect(state.variant).toBe('connection-issue');
    expect(state.primaryCta?.action).toBe('retry');
  });

  it('maps ApiError with status=0 / code=network-error to the connection-issue variant', () => {
    const state = mapCartError(apiError(0, { code: 'network-error' }));
    expect(state.variant).toBe('connection-issue');
    expect(state.primaryCta?.action).toBe('retry');
  });

  it('maps an ApiTimeoutError to the connection-issue variant', () => {
    const state = mapCartError(new ApiTimeoutError());
    expect(state.variant).toBe('connection-issue');
  });

  it('treats a TypeError from fetch as a network issue', () => {
    const state = mapCartError(new TypeError('Failed to fetch'));
    expect(state.variant).toBe('connection-issue');
  });

  it('falls back to the unknown variant for a random thrown value', () => {
    const state = mapCartError({ weird: true });
    expect(state.variant).toBe('unknown');
    expect(state.primaryCta?.action).toBe('retry');
    expect(state.secondaryCta?.action).toBe('report');
  });

  it('treats an unexpected status (e.g. 418) as unknown', () => {
    const state = mapCartError(apiError(418));
    expect(state.variant).toBe('unknown');
  });

  it('preserves status + requestId for support tickets', () => {
    const state = mapCartError(apiError(500, { requestId: 'req_abc123' }));
    expect(state.status).toBe(500);
    expect(state.requestId).toBe('req_abc123');
  });

  it('exposes the same cooldown constant via the testing hook as it sets on state', () => {
    const state = mapCartError(apiError(429));
    expect(state.cooldownMs).toBe(__testing.RATE_LIMIT_COOLDOWN_MS);
  });
});

describe('reportCartError', () => {
  it('writes to console.error with the variant, status and requestId', () => {
    const state: CartErrorState = {
      variant: 'unknown',
      title: 'x',
      message: 'y',
      primaryCta: null,
      secondaryCta: null,
      status: 418,
      requestId: 'req_xyz',
    };
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = ((...args: unknown[]) => {
      calls.push(args);
    }) as typeof console.error;
    try {
      reportCartError(state, new Error('boom'));
    } finally {
      console.error = original;
    }
    expect(calls).toHaveLength(1);
    const payload = calls[0][1] as { variant: string; status: number; requestId: string };
    expect(payload.variant).toBe('unknown');
    expect(payload.status).toBe(418);
    expect(payload.requestId).toBe('req_xyz');
  });
});
