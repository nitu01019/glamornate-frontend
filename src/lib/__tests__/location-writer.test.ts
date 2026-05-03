/**
 * Tests for `setActiveLocation` (src/lib/location-writer.ts).
 *
 * Contract under test:
 *  - `kind: 'saved-address'` → promotes the picked address to `isDefault`
 *    in Firestore via `updateDoc`, THEN writes the legacy
 *    `location-provider` slice. If the provider write throws, the Firestore
 *    write is rolled back so the two stores never diverge.
 *  - `kind: 'gps'`           → calls the supplied `reverseGeocode`, writes
 *    ONLY to the provider. No Firestore writes.
 *  - `kind: 'manual-city'`   → writes ONLY to the provider. No Firestore,
 *    no geocode.
 *  - Every successful call clears the legacy
 *    `glamornate_user_location` localStorage key exactly once.
 *
 * Firestore, Auth, and geolocation are fully mocked — the test never
 * touches the network.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { SavedAddress } from '@/types';
import type { UserLocation } from '@/lib/location-provider';

// ---------------------------------------------------------------------------
// Firestore mock — `doc` returns a path sentinel, `getDoc` returns the
// current fixture, `updateDoc` records the patch and optionally throws.
// ---------------------------------------------------------------------------

interface FirestoreState {
  addresses: SavedAddress[];
  updateCalls: Array<{ ref: unknown; data: unknown }>;
  updateShouldThrowOnNext: boolean;
}

const fsState: FirestoreState = {
  addresses: [],
  updateCalls: [],
  updateShouldThrowOnNext: false,
};

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...pathSegments: string[]) => ({
    type: 'document',
    path: pathSegments.join('/'),
  })),
  getDoc: vi.fn(async () => ({
    exists: () => fsState.addresses.length > 0,
    data: () => ({ addresses: fsState.addresses }),
  })),
  updateDoc: vi.fn(async (ref: unknown, data: unknown) => {
    fsState.updateCalls.push({ ref, data });
    if (fsState.updateShouldThrowOnNext) {
      fsState.updateShouldThrowOnNext = false;
      throw new Error('boom: firestore updateDoc failed');
    }
    // Reflect the patch back into the fixture so subsequent getDoc calls
    // see the new state (mirrors real Firestore semantics well enough for
    // rollback assertions).
    const patch = data as { addresses?: SavedAddress[] };
    if (patch.addresses) {
      fsState.addresses = [...patch.addresses];
    }
  }),
}));

// ---------------------------------------------------------------------------
// Firebase-client mock — hand back sentinel objects.
// ---------------------------------------------------------------------------

let mockCurrentUser: { uid: string } | null = null;

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseFirestore: vi.fn(() => ({ __mock: 'firestore' })),
  getFirebaseAuth: vi.fn(() => ({
    get currentUser() {
      return mockCurrentUser;
    },
  })),
}));

// ---------------------------------------------------------------------------
// Geolocation mock — `requestCoords` is only invoked by the `gps` convenience
// wrapper; we stub it so module import doesn't pull in `@capacitor/geolocation`.
// ---------------------------------------------------------------------------

vi.mock('@/lib/geolocation', () => ({
  requestCoords: vi.fn(async () => ({
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 10,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: 'addr-1',
    label: 'home',
    name: 'Jane Doe',
    phone: '+919999999999',
    flatHouse: 'B-101',
    street: 'MG Road',
    landmark: 'Metro pillar 42',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    isDefault: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

interface TestProvider {
  setLocation: (loc: UserLocation) => void;
  locations: UserLocation[];
  spy: Mock;
}

function makeProvider(): TestProvider {
  const locations: UserLocation[] = [];
  const spy = vi.fn((loc: UserLocation) => {
    locations.push(loc);
  });
  return {
    setLocation: spy as unknown as (loc: UserLocation) => void,
    locations,
    spy: spy as unknown as Mock,
  };
}

const LEGACY_KEY = 'glamornate_user_location';

beforeEach(() => {
  fsState.addresses = [];
  fsState.updateCalls = [];
  fsState.updateShouldThrowOnNext = false;
  mockCurrentUser = null;
  try {
    window.localStorage.clear();
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ city: 'StaleCity' }));
  } catch {
    // Some environments block localStorage — the test tolerates absence.
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('setActiveLocation — saved-address', () => {
  it('promotes the picked address to isDefault and writes the provider', async () => {
    mockCurrentUser = { uid: 'user-A' };
    fsState.addresses = [
      makeAddress({ id: 'a', isDefault: true }),
      makeAddress({ id: 'b', isDefault: false, city: 'Mumbai' }),
    ];

    const provider = makeProvider();
    const { setActiveLocation } = await import('../location-writer');

    await setActiveLocation({ kind: 'saved-address', addressId: 'b' }, { provider: provider });

    // Firestore must have seen a single updateDoc with the flipped defaults.
    expect(fsState.updateCalls).toHaveLength(1);
    const patch = fsState.updateCalls[0].data as { addresses: SavedAddress[] };
    const a = patch.addresses.find((x) => x.id === 'a');
    const b = patch.addresses.find((x) => x.id === 'b');
    expect(a?.isDefault).toBe(false);
    expect(b?.isDefault).toBe(true);
    expect(b?.updatedAt).not.toBe('2026-04-01T00:00:00.000Z');

    // Provider must have been invoked with a mapped UserLocation for `b`.
    expect(provider.spy).toHaveBeenCalledTimes(1);
    expect(provider.locations[0].city).toBe('Mumbai');

    // Legacy storage must be cleared on success.
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('throws not-authenticated when no Firebase user is signed in', async () => {
    mockCurrentUser = null;
    const provider = makeProvider();
    const { setActiveLocation, LocationWriteError } = await import('../location-writer');

    await expect(
      setActiveLocation({ kind: 'saved-address', addressId: 'a' }, { provider }),
    ).rejects.toBeInstanceOf(LocationWriteError);

    // No Firestore write attempted, no provider write, legacy key still there.
    expect(fsState.updateCalls).toHaveLength(0);
    expect(provider.spy).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it('throws address-not-found when the id is missing from the user doc', async () => {
    mockCurrentUser = { uid: 'user-A' };
    fsState.addresses = [makeAddress({ id: 'a', isDefault: true })];
    const provider = makeProvider();
    const { setActiveLocation, LocationWriteError } = await import('../location-writer');

    await expect(
      setActiveLocation({ kind: 'saved-address', addressId: 'ghost' }, { provider }),
    ).rejects.toMatchObject({
      code: 'address-not-found',
      name: 'LocationWriteError',
    });
    void LocationWriteError;

    // No updateDoc fired — promoteAddressToDefault bails before the write.
    expect(fsState.updateCalls).toHaveLength(0);
    expect(provider.spy).not.toHaveBeenCalled();
  });

  it('rolls back the Firestore write if the provider throws', async () => {
    mockCurrentUser = { uid: 'user-A' };
    fsState.addresses = [
      makeAddress({ id: 'a', isDefault: true }),
      makeAddress({ id: 'b', isDefault: false, city: 'Pune' }),
    ];

    // Provider throws on first call → we expect a second updateDoc rollback.
    const provider = {
      setLocation: vi.fn(() => {
        throw new Error('provider exploded');
      }),
    };

    const { setActiveLocation, LocationWriteError } = await import('../location-writer');

    await expect(
      setActiveLocation({ kind: 'saved-address', addressId: 'b' }, { provider }),
    ).rejects.toBeInstanceOf(LocationWriteError);

    // Two updateDoc calls total: the promotion + the rollback.
    expect(fsState.updateCalls).toHaveLength(2);

    // Legacy storage MUST NOT be cleared on failure — the selection didn't
    // land, so the fallback still needs to work next time.
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });
});

describe('setActiveLocation — gps', () => {
  it('writes the reverse-geocoded location to the provider only', async () => {
    const provider = makeProvider();
    const reverseGeocode = vi.fn(async () => ({
      city: 'Bengaluru',
      area: 'Koramangala',
      fullAddress: 'Koramangala, Bengaluru 560034',
    }));

    const { setActiveLocation } = await import('../location-writer');

    await setActiveLocation(
      {
        kind: 'gps',
        coords: { latitude: 12.93, longitude: 77.62 },
      },
      { provider, reverseGeocode },
    );

    expect(reverseGeocode).toHaveBeenCalledWith(12.93, 77.62);
    expect(provider.spy).toHaveBeenCalledTimes(1);

    const wrote = provider.locations[0];
    expect(wrote.city).toBe('Bengaluru');
    expect(wrote.area).toBe('Koramangala');
    expect(wrote.lat).toBe(12.93);
    expect(wrote.lng).toBe(77.62);

    // No Firestore activity for GPS.
    expect(fsState.updateCalls).toHaveLength(0);

    // Legacy cleared.
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('surfaces geocode-failed when reverse geocoding throws', async () => {
    const provider = makeProvider();
    const reverseGeocode = vi.fn(async () => {
      throw new Error('nominatim down');
    });

    const { setActiveLocation, LocationWriteError } = await import('../location-writer');

    await expect(
      setActiveLocation(
        { kind: 'gps', coords: { latitude: 0, longitude: 0 } },
        { provider, reverseGeocode },
      ),
    ).rejects.toMatchObject({ code: 'geocode-failed' });

    expect(provider.spy).not.toHaveBeenCalled();
    // On failure, legacy key MUST NOT be cleared.
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull();
    void LocationWriteError;
  });
});

describe('setActiveLocation — manual-city', () => {
  it('writes the city/area to the provider without a Firestore hit', async () => {
    const provider = makeProvider();
    const { setActiveLocation } = await import('../location-writer');

    await setActiveLocation(
      {
        kind: 'manual-city',
        city: 'Delhi',
        area: 'South Ex',
        pincode: '110049',
      },
      { provider },
    );

    expect(provider.spy).toHaveBeenCalledTimes(1);
    const wrote = provider.locations[0];
    expect(wrote.city).toBe('Delhi');
    expect(wrote.area).toBe('South Ex');
    expect(wrote.fullAddress).toContain('Delhi');
    expect(wrote.fullAddress).toContain('110049');

    expect(fsState.updateCalls).toHaveLength(0);
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('falls back to city as the area when none is provided', async () => {
    const provider = makeProvider();
    const { setActiveLocation } = await import('../location-writer');

    await setActiveLocation({ kind: 'manual-city', city: 'Chennai' }, { provider });

    expect(provider.spy).toHaveBeenCalledTimes(1);
    const wrote = provider.locations[0];
    expect(wrote.city).toBe('Chennai');
    expect(wrote.area).toBe('Chennai');
  });
});
