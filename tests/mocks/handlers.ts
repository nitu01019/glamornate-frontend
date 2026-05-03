/**
 * MSW request handlers — the canonical test-server routing table.
 *
 * Handlers listed here run for EVERY spec that uses the shared `server`
 * (wired via `src/test/setup.ts`). Per-spec overrides can be layered on
 * with `server.use(http.X(...))` inside an individual test.
 *
 * Conventions
 * -----------
 *   - Focus on hot paths only. Do NOT try to model every callable / every
 *     Firestore read here — that belongs in the spec itself via
 *     `server.use(...)`.
 *   - All handlers must return an `ApiResponse<T>` envelope
 *     ({ success, data, error, code? }) for `/api/v1/*` routes; raw JSON
 *     for third-party hosts.
 *   - Keep payloads minimal — pull richer fixtures from
 *     `tests/fixtures/*` when a spec needs them.
 *
 * Extending
 * ---------
 * When a new spec would otherwise reach for `vi.mock('@/lib/api-client')`
 * or `vi.mock('global.fetch')`, add an MSW handler here instead.
 */

import { http, HttpResponse } from 'msw';

// ----------------------------------------------------------------------------
// Default base URL used by the api-client when NEXT_PUBLIC_API_URL is unset.
// The api-client falls back to `http://localhost:3000/api/v1` in jsdom.
// ----------------------------------------------------------------------------

const API_ROOT = '*/api/v1';

// ----------------------------------------------------------------------------
// Auth endpoints
// ----------------------------------------------------------------------------

const authHandlers = [
  /**
   * POST /api/v1/auth/register
   * Covered in rate-limit specs; default response is a happy registration.
   */
  http.post(`${API_ROOT}/auth/register`, async () => {
    return HttpResponse.json(
      {
        success: true,
        data: { uid: 'uid-new-user', email: 'new@example.com' },
        error: null,
      },
      { status: 200 },
    );
  }),
];

// ----------------------------------------------------------------------------
// Generic resource endpoints
// ----------------------------------------------------------------------------

const resourceHandlers = [
  /**
   * GET /api/v1/spas/:id — used by api-client happy-path tests.
   */
  http.get(`${API_ROOT}/spas/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { id: params.id },
      error: null,
    });
  }),

  /**
   * GET /api/v1/bookings — generic list fetch for api-client tests.
   */
  http.get(`${API_ROOT}/bookings`, () => {
    return HttpResponse.json({
      success: true,
      data: { ok: true },
      error: null,
    });
  }),

  /**
   * POST /api/v1/reviews — used by api-client header-propagation tests.
   */
  http.post(`${API_ROOT}/reviews`, () => {
    return HttpResponse.json({
      success: true,
      data: null,
      error: null,
    });
  }),
];

// ----------------------------------------------------------------------------
// Firestore REST — catch-all for unmocked Firestore reads so individual
// specs don't accidentally hit the network. Specs that care about the
// shape of the response should `server.use(http.get(..., ...))`.
// ----------------------------------------------------------------------------

const firestoreHandlers = [
  http.get('https://firestore.googleapis.com/v1/projects/*/databases/*/documents/*', () => {
    return HttpResponse.json({ documents: [] }, { status: 200 });
  }),
];

export const handlers = [...authHandlers, ...resourceHandlers, ...firestoreHandlers];
