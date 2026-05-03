/**
 * QA-M4 — Fixture loader.
 *
 * Canonical way for a spec to load JSON data from `tests/fixtures/`. Keeps
 * fixture path resolution centralised so that if the directory ever moves
 * again we only update one file.
 *
 * Usage
 * -----
 *   const booking = await loadFixture<MockBooking>('bookings/draft.json');
 *
 * Design notes
 * ------------
 *   - Sync via `fs.readFileSync` would be simpler but keeping the API
 *     async lets us swap to a `fetch`-based implementation in the
 *     browser bundle later without churning call sites.
 *   - We deliberately ONLY support JSON files here — TypeScript fixture
 *     modules (e.g. `mockServices.ts`) should be `import`ed directly:
 *     `import { mockServices } from '../../tests/fixtures/mockServices';`
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Absolute filesystem path to the `tests/fixtures/` directory, resolved
 * once at module load so callers never need to know where we live.
 */
const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'tests',
  'fixtures',
);

export async function loadFixture<T extends JsonValue = JsonValue>(name: string): Promise<T> {
  // Block path traversal — fixtures must live under FIXTURES_ROOT.
  const resolved = path.resolve(FIXTURES_ROOT, name);
  if (!resolved.startsWith(FIXTURES_ROOT + path.sep)) {
    throw new Error(`fixture path escapes root: ${name}`);
  }

  let raw: string;
  try {
    raw = await readFile(resolved, 'utf8');
  } catch (err) {
    throw new Error(
      `fixture not found: ${name} (resolved to ${resolved}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(
      `fixture ${name} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
