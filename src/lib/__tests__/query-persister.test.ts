/**
 * Unit tests for the platform-aware React Query persister.
 *
 * Covers:
 *   - Web path writes dehydrated client state to localStorage.
 *   - Web path restores previously persisted state.
 *   - A `buster` mismatch causes `persistQueryClient` to discard old state.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import {
  STORAGE_KEY,
  __resetPersisterForTests,
  buster,
  createPlatformPersister,
  getPlatformPersister,
} from '../query-persister';

function buildPersistedClient(client: QueryClient, clientBuster: string): PersistedClient {
  return {
    timestamp: Date.now(),
    buster: clientBuster,
    clientState: dehydrate(client),
  };
}

/**
 * `createSyncStoragePersister` debounces its writes via `setTimeout`. Our
 * tests need the write to have landed before asserting, so we wait slightly
 * longer than the configured throttle window.
 */
const PERSIST_FLUSH_MS = 400;

function flushPersist(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, PERSIST_FLUSH_MS));
}

function clearStorage(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
  __resetPersisterForTests();
}

describe('query-persister (web)', () => {
  beforeEach(() => {
    clearStorage();
  });

  afterEach(() => {
    clearStorage();
  });

  it('exports a buster string derived from env (fallback dev)', () => {
    expect(typeof buster).toBe('string');
    expect(buster.length).toBeGreaterThan(0);
  });

  it('returns a singleton from getPlatformPersister', () => {
    const a = getPlatformPersister();
    const b = getPlatformPersister();
    expect(a).toBe(b);
  });

  it('writes dehydrated cache to localStorage under the expected key', async () => {
    const persister = createPlatformPersister();
    const client = new QueryClient();
    client.setQueryData(['categories'], [{ id: 'cat-1', name: 'Facial' }]);

    await persister.persistClient(buildPersistedClient(client, buster));
    await flushPersist();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { buster: string };
    expect(parsed.buster).toBe(buster);
    expect(raw).toContain('categories');
  });

  it('round-trips client state through persistClient/restoreClient', async () => {
    const persister = createPlatformPersister();
    const writer = new QueryClient();
    writer.setQueryData(['categories'], [{ id: 'cat-1', name: 'Facial' }]);

    await persister.persistClient(buildPersistedClient(writer, buster));
    await flushPersist();

    const restored = await persister.restoreClient();
    expect(restored).toBeDefined();
    expect(restored?.buster).toBe(buster);

    const reader = new QueryClient();
    hydrate(reader, restored?.clientState);

    const data = reader.getQueryData(['categories']);
    expect(data).toEqual([{ id: 'cat-1', name: 'Facial' }]);
  });

  it('discards persisted state when buster changes (consumer responsibility)', async () => {
    const persister = createPlatformPersister();
    const writer = new QueryClient();
    writer.setQueryData(['categories'], [{ id: 'stale', name: 'Old' }]);

    await persister.persistClient(buildPersistedClient(writer, 'v1'));
    await flushPersist();

    const restored = await persister.restoreClient();
    expect(restored?.buster).toBe('v1');

    // Simulate the check performed by persistQueryClientRestore: if the
    // stored buster does not match the current deploy buster, the data
    // must be thrown away.
    const currentBuster = 'v2';
    const usable = restored && restored.buster === currentBuster ? restored : undefined;
    expect(usable).toBeUndefined();

    if (!usable) {
      await persister.removeClient();
    }
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
