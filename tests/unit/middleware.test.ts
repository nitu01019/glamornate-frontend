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

  // L-1 (2026-05-11): UT-11, UT-15, the __session-cookie test, and the
  // /api/spa 401 test were deleted along with the dead `protectedRoutes`
  // middleware gate. The paths they exercised — /api/admin|customer|spa/* —
  // have no corresponding Next.js route handlers in src/app/api/.

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
      // 2026-05-11 (T3-F60): X-XSS-Protection dropped (deprecated header,
      // OWASP recommends omitting; CSP supersedes).
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
          ([key]: [string]) => key === headerName,
        );
        expect(matchingCall).toBeDefined();
        expect(matchingCall[1]).toMatch(expected);
      }
    }
  });

  // Non-protected API routes pass through without auth (sanity check that
  // middleware doesn't block API routes now that the dead gate is gone).
  it('passes through API routes without auth (L-1: gate removed)', () => {
    const req = createMockRequest({ pathname: '/api/v1/health' });

    const result = middleware(req);

    expect(mockNextResponseJson).not.toHaveBeenCalled();
    expect(mockNextResponseNext).toHaveBeenCalled();
  });
});
