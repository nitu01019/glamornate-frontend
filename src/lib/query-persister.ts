/**
 * Platform-aware React Query persister.
 *
 * Web: uses `@tanstack/query-sync-storage-persister` backed by window.localStorage.
 * Native (Capacitor): uses an async persister backed by `@capacitor/preferences`.
 *
 * A `buster` value tied to the app version invalidates persisted cache across
 * deploys so users never see stale queries after an app update.
 */

import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const STORAGE_KEY = 'glamornate-rq-cache-v1';

/**
 * Release identifier used to bust the persisted cache on app version change.
 * Keep this value in sync with `process.env.NEXT_PUBLIC_APP_VERSION`; fall
 * back to a phase-anchored constant when running locally without an
 * injected version.
 *
 * Phase 3 (Booking Flow Fix v3.1, 2026-05-02): bumped fallback so old
 * cached payloads with the legacy `duration` key are invalidated on the
 * Wave 3 redeploy and clients pick up the new `serviceDuration` shape.
 */
export const buster: string = process.env.NEXT_PUBLIC_APP_VERSION ?? 'v3.1-2026-05-02';

type CapacitorWindow = {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

type CapacitorPreferencesModule = {
  Preferences: {
    get: (options: { key: string }) => Promise<{ value: string | null }>;
    set: (options: { key: string; value: string }) => Promise<void>;
    remove: (options: { key: string }) => Promise<void>;
  };
};

/**
 * SSR-safe no-op persister used during server render so we never touch
 * `window` or Capacitor bridges on the Node side.
 */
function createNoopPersister(): Persister {
  return {
    persistClient: async () => undefined,
    restoreClient: async () => undefined,
    removeClient: async () => undefined,
  };
}

/**
 * Synchronous check for the Capacitor native bridge. Capacitor injects a
 * global `window.Capacitor` object in native WebViews, so this avoids a
 * dynamic import on the web path.
 */
function detectNativePlatformSync(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const maybeCap = (window as unknown as CapacitorWindow).Capacitor;
    return Boolean(maybeCap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/**
 * Async Persister backed by `@capacitor/preferences`. Serializes the full
 * PersistedClient as JSON under a single key. Suitable for the dehydrated
 * cache sizes we expect (<< 100 KB).
 *
 * The Preferences module is imported dynamically on first invocation so the
 * web bundle does not eagerly load the native bridge code.
 */
function createCapacitorPersister(): Persister {
  let preferencesPromise: Promise<CapacitorPreferencesModule['Preferences']> | null = null;

  const getPreferences = () => {
    if (!preferencesPromise) {
      preferencesPromise = import('@capacitor/preferences').then(
        (m) => (m as unknown as CapacitorPreferencesModule).Preferences,
      );
    }
    return preferencesPromise;
  };

  return {
    persistClient: async (client: PersistedClient): Promise<void> => {
      try {
        const Preferences = await getPreferences();
        const value = JSON.stringify(client);
        await Preferences.set({ key: STORAGE_KEY, value });
      } catch {
        // Swallow persist errors: the in-memory cache remains the source of truth.
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const Preferences = await getPreferences();
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        if (!value) return undefined;
        return JSON.parse(value) as PersistedClient;
      } catch {
        return undefined;
      }
    },
    removeClient: async (): Promise<void> => {
      try {
        const Preferences = await getPreferences();
        await Preferences.remove({ key: STORAGE_KEY });
      } catch {
        // Best-effort removal.
      }
    },
  };
}

/**
 * Returns the appropriate persister for the current platform.
 *
 * The return value is synchronous so it can be passed directly to
 * `<PersistQueryClientProvider persistOptions={{ persister, ... }} />`.
 * On native we return a persister whose methods dynamically import
 * `@capacitor/preferences` on first use.
 */
export function createPlatformPersister(): Persister {
  if (typeof window === 'undefined') {
    return createNoopPersister();
  }

  if (detectNativePlatformSync()) {
    return createCapacitorPersister();
  }

  return createSyncStoragePersister({
    storage: window.localStorage,
    key: STORAGE_KEY,
    // Debounce writes to avoid thrashing localStorage on rapid cache updates.
    // 250ms is well under the typical page-lifetime while still coalescing
    // bursts from parallel background refetches.
    throttleTime: 250,
  });
}

// Singleton so providers.tsx reuses the same instance across renders.
let persisterSingleton: Persister | null = null;

export function getPlatformPersister(): Persister {
  if (!persisterSingleton) {
    persisterSingleton = createPlatformPersister();
  }
  return persisterSingleton;
}

// Exported for tests only — resets the singleton.
export function __resetPersisterForTests(): void {
  persisterSingleton = null;
}

export { STORAGE_KEY };
