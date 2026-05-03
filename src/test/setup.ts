// Node 25+ exposes a built-in `localStorage` that requires `--localstorage-file`.
// Without a valid file it has no `setItem` / `getItem`, which breaks zustand's
// persist middleware.  Replace it with a simple in-memory implementation before
// any store module is imported.
if (
  typeof globalThis.localStorage === 'undefined' ||
  typeof globalThis.localStorage?.setItem !== 'function'
) {
  const _store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => _store[key] ?? null,
      setItem: (key: string, value: string) => {
        _store[key] = value;
      },
      removeItem: (key: string) => {
        delete _store[key];
      },
      clear: () => {
        for (const k of Object.keys(_store)) delete _store[k];
      },
      get length() {
        return Object.keys(_store).length;
      },
      key: (i: number) => Object.keys(_store)[i] ?? null,
    },
    writable: true,
    configurable: true,
  });
}

import '@testing-library/jest-dom/vitest';

// ---------------------------------------------------------------------------
// QA-M1 — Mock Service Worker lifecycle
// ---------------------------------------------------------------------------
//
// Every spec runs against a shared MSW server (see `tests/mocks/server.ts`).
// Handlers are reset between tests so per-spec overrides via `server.use(...)`
// never leak across files. `onUnhandledRequest: 'bypass'` keeps the migration
// incremental — legacy specs that still mock `fetch` directly or use
// `vi.mock` keep passing unchanged.
// ---------------------------------------------------------------------------

import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../../tests/mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
