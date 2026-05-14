/**
 * Tests for `reverseGeocodeCoords` (reverse-geocode-client.ts).
 *
 * Every dependency (Firebase functions SDK, app loader) is mocked via the
 * injectable `callable` option so the suite runs without Firebase. The key
 * contract is: the function NEVER throws for expected business errors. It
 * always resolves to a `{ status }`-tagged result.
 *
 * Scenarios covered:
 *   1. Happy path — returns `{ status: 'ok', ... }` with all fields.
 *   2. `functions/failed-precondition` + `geocode/not-configured` → `not-configured`.
 *   3. `functions/failed-precondition` + `geocode/request-denied` → `not-configured`
 *      (Google rejected the key; UX identical to "no key").
 *   4. `functions/resource-exhausted` → `quota`.
 *   5. `functions/unauthenticated` → `unauthenticated`.
 *   6. `functions/invalid-argument` → `invalid-input`.
 *   7. Client-side pre-validation — invalid lat → `invalid-input` (no call).
 *   8. Unexpected error → `{ status: 'error' }` without throwing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseError } from 'firebase/app';

// Mock the logger so tests don't spam.
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock the Firebase app/functions bridges — they should never be touched
// because every test path injects its own `callable`.
vi.mock('@/lib/firebase', () => ({
  getFirebaseApp: vi.fn(() => {
    throw new Error('should not be called — tests inject callable');
  }),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

import { reverseGeocodeCoords, type ReverseGeocodeCallable } from '../reverse-geocode-client';

const BENGALURU = { lat: 12.9716, lng: 77.5946 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reverseGeocodeCoords', () => {
  it('happy path — returns status=ok with all fields', async () => {
    const callable: ReverseGeocodeCallable = vi.fn(async () => ({
      data: {
        formattedAddress: '100 MG Road, Bengaluru, Karnataka 560001, India',
        components: {
          line1: 'MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          country: 'India',
        },
        placeId: 'place_123',
        cachedAt: 1_700_000_000_000,
        source: 'google' as const,
      },
    }));

    const result = await reverseGeocodeCoords(BENGALURU, { callable });

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.formattedAddress).toContain('MG Road');
      expect(result.components.city).toBe('Bengaluru');
      expect(result.placeId).toBe('place_123');
      expect(result.source).toBe('google');
    }
  });

  it('maps failed-precondition / geocode/not-configured → not-configured', async () => {
    const err = new FirebaseError(
      'functions/failed-precondition',
      'geocode/not-configured',
    );
    const callable: ReverseGeocodeCallable = vi.fn(async () => {
      throw err;
    });

    const result = await reverseGeocodeCoords(BENGALURU, { callable });
    expect(result).toEqual({ status: 'not-configured' });
  });

  it('maps failed-precondition / geocode/request-denied → not-configured', async () => {
    const err = new FirebaseError(
      'functions/failed-precondition',
      'geocode/request-denied',
    );
    const callable: ReverseGeocodeCallable = vi.fn(async () => {
      throw err;
    });

    const result = await reverseGeocodeCoords(BENGALURU, { callable });
    expect(result).toEqual({ status: 'not-configured' });
  });

  it('maps resource-exhausted → quota', async () => {
    const err = new FirebaseError('functions/resource-exhausted', 'geocode/quota');
    const callable: ReverseGeocodeCallable = vi.fn(async () => {
      throw err;
    });

    const result = await reverseGeocodeCoords(BENGALURU, { callable });
    expect(result).toEqual({ status: 'quota' });
  });

  it('maps unauthenticated → unauthenticated', async () => {
    const err = new FirebaseError('functions/unauthenticated', 'auth/required');
    const callable: ReverseGeocodeCallable = vi.fn(async () => {
      throw err;
    });

    const result = await reverseGeocodeCoords(BENGALURU, { callable });
    expect(result).toEqual({ status: 'unauthenticated' });
  });

  it('maps invalid-argument → invalid-input', async () => {
    const err = new FirebaseError('functions/invalid-argument', 'Validation failed');
    const callable: ReverseGeocodeCallable = vi.fn(async () => {
      throw err;
    });

    const result = await reverseGeocodeCoords(BENGALURU, { callable });
    expect(result).toEqual({ status: 'invalid-input' });
  });

  it('maps not-found / geocode/no-results → no-results', async () => {
    const err = new FirebaseError('functions/not-found', 'geocode/no-results');
    const callable: ReverseGeocodeCallable = vi.fn(async () => {
      throw err;
    });

    const result = await reverseGeocodeCoords(BENGALURU, { callable });
    expect(result).toEqual({ status: 'no-results' });
  });

  it('pre-validates: lat out of range short-circuits to invalid-input', async () => {
    const callable: ReverseGeocodeCallable = vi.fn();

    const result = await reverseGeocodeCoords({ lat: 999, lng: 0 }, { callable });
    expect(result).toEqual({ status: 'invalid-input' });
    expect(callable).not.toHaveBeenCalled();
  });

  it('pre-validates: NaN coords short-circuit to invalid-input', async () => {
    const callable: ReverseGeocodeCallable = vi.fn();

    const result = await reverseGeocodeCoords(
      { lat: Number.NaN, lng: 0 },
      { callable },
    );
    expect(result).toEqual({ status: 'invalid-input' });
    expect(callable).not.toHaveBeenCalled();
  });

  it('unexpected error resolves to { status: "error" } (never throws)', async () => {
    const callable: ReverseGeocodeCallable = vi.fn(async () => {
      throw new Error('network gone');
    });

    const result = await reverseGeocodeCoords(BENGALURU, { callable });
    expect(result.status).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// In-flight dedupe (red-team T-A5 test gap)
// ---------------------------------------------------------------------------
// Two consumers (e.g. HomeLocationSheet GPS row + LocationMapPin drag-end +
// usePreWarmLocation) requesting the same coord cell within the same animation
// frame must share ONE Firebase callable round-trip — otherwise we'd burn
// quota and pay double latency.
//
// `options.callable` injection bypasses the dedupe map intentionally (tests
// shouldn't leak state across the module-scoped Map), so we use the DEFAULT
// callable via the dedupe path by NOT passing `options.callable` and instead
// mocking the underlying `firebase/functions` modules.

import {
  reverseGeocodeCoords as reverseGeocodeCoordsDefault,
  __resetReverseGeocodeInFlightForTests,
} from '../reverse-geocode-client';
import * as firebaseFunctions from 'firebase/functions';
import * as firebaseApp from '@/lib/firebase';

describe('reverseGeocodeCoords — in-flight dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetReverseGeocodeInFlightForTests();
  });

  it('shares one callable invocation across concurrent same-cell callers', async () => {
    // Build a single underlying callable invocation we can count.
    const underlying = vi.fn(async () => ({
      data: {
        formattedAddress: 'MG Road, Bengaluru',
        components: { city: 'Bengaluru' },
        cachedAt: Date.now(),
        source: 'google' as const,
      },
    }));
    vi.mocked(firebaseApp.getFirebaseApp).mockReturnValue({} as never);
    vi.mocked(firebaseFunctions.getFunctions).mockReturnValue({} as never);
    vi.mocked(firebaseFunctions.httpsCallable).mockReturnValue(underlying as never);

    // Two concurrent calls for the same cell (4dp grid identical).
    const [a, b] = await Promise.all([
      reverseGeocodeCoordsDefault({ lat: 12.97161, lng: 77.59461 }),
      reverseGeocodeCoordsDefault({ lat: 12.97162, lng: 77.59462 }),
    ]);

    expect(underlying).toHaveBeenCalledTimes(1);
    expect(a.status).toBe('ok');
    expect(b.status).toBe('ok');
  });

  it('different cells produce independent callable invocations', async () => {
    const underlying = vi.fn(async () => ({
      data: {
        formattedAddress: 'somewhere',
        components: {},
        cachedAt: Date.now(),
        source: 'google' as const,
      },
    }));
    vi.mocked(firebaseApp.getFirebaseApp).mockReturnValue({} as never);
    vi.mocked(firebaseFunctions.getFunctions).mockReturnValue({} as never);
    vi.mocked(firebaseFunctions.httpsCallable).mockReturnValue(underlying as never);

    await Promise.all([
      reverseGeocodeCoordsDefault({ lat: 12.9716, lng: 77.5946 }),
      reverseGeocodeCoordsDefault({ lat: 28.6139, lng: 77.209 }),
    ]);
    expect(underlying).toHaveBeenCalledTimes(2);
  });

  it('clears the in-flight entry on settle so subsequent calls are not stuck', async () => {
    const underlying = vi.fn(async () => ({
      data: {
        formattedAddress: 'MG Road, Bengaluru',
        components: {},
        cachedAt: Date.now(),
        source: 'google' as const,
      },
    }));
    vi.mocked(firebaseApp.getFirebaseApp).mockReturnValue({} as never);
    vi.mocked(firebaseFunctions.getFunctions).mockReturnValue({} as never);
    vi.mocked(firebaseFunctions.httpsCallable).mockReturnValue(underlying as never);

    await reverseGeocodeCoordsDefault({ lat: 12.9716, lng: 77.5946 });
    await reverseGeocodeCoordsDefault({ lat: 12.9716, lng: 77.5946 });
    // First call goes through, second is a fresh in-flight (after the first
    // settled and was cleared from the dedupe map).
    expect(underlying).toHaveBeenCalledTimes(2);
  });
});
