/**
 * Middleware Tests
 *
 * Verifies the Next.js middleware for API route protection and security headers.
 * Tests cover: unauthenticated API access, page route pass-through, security
 * headers, and authenticated API access.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks for next/server
// ---------------------------------------------------------------------------

const mockNextResponseJson = vi.fn();
const mockNextResponseNext = vi.fn();
const mockHeadersSet = vi.fn();
const mockHeadersGet = vi.fn();

vi.mock('next/server', () => {
  const headers = new Map();

  const responseObj = {
    headers: {
      set: (key: string, value: string) => {
        mockHeadersSet(key, value);
        headers.set(key, value);
      },
      get: (key: string) => {
        mockHeadersGet(key);
        return headers.get(key);
      },
    },
  };

  return {
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => {
        mockNextResponseJson(body, init);
        return { body, status: init?.status ?? 200 };
      },
      next: () => {
        mockNextResponseNext();
        headers.clear();
        return responseObj;
      },
    },
  };
});

// Import AFTER mocks are set up
import { middleware } from '@/middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(options: {
  pathname: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}) {
  const { pathname, headers = {}, cookies = {} } = options;

  return {
    nextUrl: {
      pathname,
      origin: 'http://localhost:3000',
    },
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    cookies: {
      get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined),
    },
  } as unknown as Parameters<typeof middleware>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UT-11: API route without auth token returns 401
  it('UT-11: returns 401 JSON for protected API route without auth token', () => {
    const req = createMockRequest({ pathname: '/api/customer/bookings' });

    const result = middleware(req);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: 'Authentication required' },
      { status: 401 }
    );
    expect(result).toMatchObject({ status: 401 });
  });

  // UT-12: Page route /customer/dashboard passes through
  it('UT-12: passes through page route /customer/dashboard without redirect', () => {
    const req = createMockRequest({ pathname: '/customer/dashboard' });

    const result = middleware(req);

    expect(mockNextResponseJson).not.toHaveBeenCalled();
    expect(mockNextResponseNext).toHaveBeenCalled();
    expect(result).toHaveProperty('headers');
  });

  // UT-13: Page route /spas passes through
  it('UT-13: passes through page route /spas without redirect', () => {
    const req = createMockRequest({ pathname: '/spas' });

    const result = middleware(req);

    expect(mockNextResponseJson).not.toHaveBeenCalled();
    expect(mockNextResponseNext).toHaveBeenCalled();
    expect(result).toHaveProperty('headers');
  });

  // UT-14: All security headers are set on responses
  it('UT-14: sets all required security headers on every response', () => {
    const req = createMockRequest({ pathname: '/spas' });

    middleware(req);

    const expectedHeaders: Array<[string, string | RegExp]> = [
      ['X-Content-Type-Options', 'nosniff'],
      ['X-Frame-Options', 'DENY'],
      ['X-XSS-Protection', '1; mode=block'],
      ['Referrer-Policy', 'strict-origin-when-cross-origin'],
      ['Strict-Transport-Security', /max-age=31536000/],
      ['Content-Security-Policy', /default-src 'self'/],
      ['Permissions-Policy', /camera=\(\)/],
    ];

    for (const [headerName, expected] of expectedHeaders) {
      if (typeof expected === 'string') {
        expect(mockHeadersSet).toHaveBeenCalledWith(headerName, expected);
      } else {
        const matchingCall = mockHeadersSet.mock.calls.find(
          ([key]: [string]) => key === headerName
        );
        expect(matchingCall).toBeDefined();
        expect(matchingCall[1]).toMatch(expected);
      }
    }
  });

  // UT-15: API route with valid auth token passes through
  it('UT-15: passes through protected API route with authorization header', () => {
    const req = createMockRequest({
      pathname: '/api/customer/bookings',
      headers: { authorization: 'Bearer valid-token-123' },
    });

    const result = middleware(req);

    expect(mockNextResponseJson).not.toHaveBeenCalled();
    expect(mockNextResponseNext).toHaveBeenCalled();
    expect(result).toHaveProperty('headers');
  });

  // Additional: API route with cookie-based auth passes through
  it('passes through protected API route with __session cookie', () => {
    const req = createMockRequest({
      pathname: '/api/admin/dashboard',
      cookies: { __session: 'session-token-abc' },
    });

    const result = middleware(req);

    expect(mockNextResponseJson).not.toHaveBeenCalled();
    expect(mockNextResponseNext).toHaveBeenCalled();
    expect(result).toHaveProperty('headers');
  });

  // Additional: Non-protected API routes pass through without auth
  it('passes through non-protected API route without auth', () => {
    const req = createMockRequest({ pathname: '/api/v1/health' });

    const result = middleware(req);

    expect(mockNextResponseJson).not.toHaveBeenCalled();
    expect(mockNextResponseNext).toHaveBeenCalled();
  });

  // Additional: Protected API /api/spa routes without auth
  it('returns 401 for protected /api/spa route without auth', () => {
    const req = createMockRequest({ pathname: '/api/spa/services' });

    const result = middleware(req);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: 'Authentication required' },
      { status: 401 }
    );
    expect(result).toMatchObject({ status: 401 });
  });
});
