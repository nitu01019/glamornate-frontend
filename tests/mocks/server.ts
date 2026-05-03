/**
 * Shared MSW test server (Node runtime — used by Vitest).
 *
 * Lifecycle is wired in `src/test/setup.ts`:
 *   beforeAll(() => server.listen())
 *   afterEach(() => server.resetHandlers())
 *   afterAll(() => server.close())
 *
 * Import this module when a test wants to override a handler for a single
 * case: `server.use(http.get(..., ...))`.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
