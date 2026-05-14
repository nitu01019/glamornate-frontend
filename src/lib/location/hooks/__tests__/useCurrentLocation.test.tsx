/**
 * Tests for useCurrentLocation (src/lib/location/hooks/useCurrentLocation.ts).
 *
 * Contract under test:
 *   - On mount, synchronously hydrates from cache (status: 'cache-hit',
 *     source: 'cache') when an entry younger than 5 min exists.
 *   - refresh() runs the bridge + backend reverse-geocode pipeline, never
 *     silently swallows. Every failure mode maps to a typed LocationErrorCode.
 *   - prompt-with-rationale → isRationaleOpen flips true; acknowledgeRationale
 *     closes the modal and re-runs the fetch.
 *   - Permission denied (one-time vs USER_FIXED) → 'permission-denied' vs
 *     'permission-permanent'.
 *   - Reverse-geocode 'quota' / 'not-configured' / 'no-results' / 'error' all
 *     surface their own typed error codes.
 *
 * All transitive dependencies (Capacitor bridge, backend client, cache,
 * platform-native helpers) are fully mocked. The test never touches the
 * network or native layer.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedLocation } from '@/lib/location/cache';

// ---------------------------------------------------------------------------
// Hoisted mock refs — Vitest hoists `vi.mock` calls so factories must use
// these stable references rather than closing over let/const.
// ---------------------------------------------------------------------------

// vi.mock factories are hoisted, so the class + mock fns must come from
// vi.hoisted() to be visible inside them.
const {
  mockRequestLocationWithRationale,
  mockReverseGeocodeCoords,
  mockReadCachedLocation,
  mockWriteCachedLocation,
  FakeLocationPermissionDeniedError,
} = vi.hoisted(() => {
  class FakeLPDE extends Error {
    readonly isPermanentlyDenied: boolean;
    needsRationale?: boolean;
    constructor(message: string, isPermanentlyDenied: boolean) {
      super(message);
      this.name = 'LocationPermissionDeniedError';
      this.isPermanentlyDenied = isPermanentlyDenied;
    }
  }
  return {
    mockRequestLocationWithRationale: vi.fn(),
    mockReverseGeocodeCoords: vi.fn(),
    mockReadCachedLocation: vi.fn(),
    mockWriteCachedLocation: vi.fn(),
    FakeLocationPermissionDeniedError: FakeLPDE,
  };
});

vi.mock('@/lib/location/capacitor-bridge', () => ({
  requestLocationWithRationale: (...args: unknown[]) =>
    mockRequestLocationWithRationale(...args),
  LocationPermissionDeniedError: FakeLocationPermissionDeniedError,
}));

vi.mock('@/lib/location/reverse-geocode-client', () => ({
  reverseGeocodeCoords: (...args: unknown[]) => mockReverseGeocodeCoords(...args),
}));

vi.mock('@/lib/location/cache', () => ({
  readCachedLocation: (...args: unknown[]) => mockReadCachedLocation(...args),
  writeCachedLocation: (...args: unknown[]) => mockWriteCachedLocation(...args),
  clearCachedLocation: vi.fn(),
}));

vi.mock('@/lib/capacitor', () => ({
  isNative: vi.fn(() => false),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Imported after the mocks so the hook sees the mocked surface.
import { useCurrentLocation } from '../useCurrentLocation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshCache(): CachedLocation {
  return {
    coords: { lat: 12.9716, lng: 77.5946 },
    address: {
      formatted: 'MG Road, Bengaluru 560001',
      line1: 'MG Road',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
    },
    capturedAt: Date.now() - 1000,
  };
}

beforeEach(() => {
  mockRequestLocationWithRationale.mockReset();
  mockReverseGeocodeCoords.mockReset();
  mockReadCachedLocation.mockReset();
  mockWriteCachedLocation.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCurrentLocation — cache hydration', () => {
  it('paints cache-hit synchronously on mount when cache is fresh', () => {
    mockReadCachedLocation.mockReturnValue(freshCache());
    const { result } = renderHook(() => useCurrentLocation());
    expect(result.current.status).toBe('cache-hit');
    expect(result.current.source).toBe('cache');
    expect(result.current.address?.formatted).toBe('MG Road, Bengaluru 560001');
    expect(result.current.coords).toEqual({ lat: 12.9716, lng: 77.5946 });
  });

  it('starts idle when there is no cache', () => {
    mockReadCachedLocation.mockReturnValue(null);
    const { result } = renderHook(() => useCurrentLocation());
    expect(result.current.status).toBe('idle');
    expect(result.current.source).toBeNull();
    expect(result.current.coords).toBeNull();
    expect(result.current.address).toBeNull();
  });
});

describe('useCurrentLocation — happy path', () => {
  it('refresh() runs bridge + reverse-geocode and lands in success', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    mockRequestLocationWithRationale.mockResolvedValueOnce({
      latitude: 12.93,
      longitude: 77.62,
      accuracy: 10,
    });
    mockReverseGeocodeCoords.mockResolvedValueOnce({
      status: 'ok',
      formattedAddress: 'Koramangala, Bengaluru 560034',
      components: {
        line1: 'Koramangala',
        city: 'Bengaluru',
        state: 'KA',
        pincode: '560034',
      },
      cachedAt: 1700000000000,
      source: 'google',
    });

    const { result } = renderHook(() => useCurrentLocation());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe('success');
    expect(result.current.source).toBe('gps');
    expect(result.current.error).toBeNull();
    expect(result.current.coords).toEqual({ lat: 12.93, lng: 77.62 });
    expect(result.current.address?.city).toBe('Bengaluru');
    expect(mockWriteCachedLocation).toHaveBeenCalledTimes(1);
  });
});

describe('useCurrentLocation — permission errors', () => {
  it('flips isRationaleOpen=true on prompt-with-rationale', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    const err = new FakeLocationPermissionDeniedError('rationale-required', false);
    err.needsRationale = true;
    mockRequestLocationWithRationale.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useCurrentLocation());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.isRationaleOpen).toBe(true);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('acknowledgeRationale closes the modal and re-runs the fetch', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    const rationaleErr = new FakeLocationPermissionDeniedError(
      'rationale-required',
      false,
    );
    rationaleErr.needsRationale = true;
    mockRequestLocationWithRationale
      .mockRejectedValueOnce(rationaleErr)
      .mockResolvedValueOnce({ latitude: 1, longitude: 2, accuracy: 5 });
    mockReverseGeocodeCoords.mockResolvedValueOnce({
      status: 'ok',
      formattedAddress: 'X',
      components: { city: 'Mumbai' },
      cachedAt: 1,
      source: 'google',
    });

    const { result } = renderHook(() => useCurrentLocation());

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.isRationaleOpen).toBe(true);

    await act(async () => {
      result.current.acknowledgeRationale();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(result.current.isRationaleOpen).toBe(false);
    expect(result.current.source).toBe('gps');
  });

  it('maps USER_FIXED denial to permission-permanent', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    mockRequestLocationWithRationale.mockRejectedValueOnce(
      new FakeLocationPermissionDeniedError('Location permission denied', true),
    );

    const { result } = renderHook(() => useCurrentLocation());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('permission-permanent');
  });

  it('maps one-time denial to permission-denied', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    mockRequestLocationWithRationale.mockRejectedValueOnce(
      new FakeLocationPermissionDeniedError('Location permission denied', false),
    );

    const { result } = renderHook(() => useCurrentLocation());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('permission-denied');
  });
});

describe('useCurrentLocation — reverse-geocode failure mapping', () => {
  it('quota → error: quota', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    mockRequestLocationWithRationale.mockResolvedValueOnce({
      latitude: 1,
      longitude: 2,
      accuracy: 5,
    });
    mockReverseGeocodeCoords.mockResolvedValueOnce({ status: 'quota' });

    const { result } = renderHook(() => useCurrentLocation());
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe('quota');
    expect(result.current.status).toBe('error');
  });

  it('not-configured → error: service-down', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    mockRequestLocationWithRationale.mockResolvedValueOnce({
      latitude: 1,
      longitude: 2,
      accuracy: 5,
    });
    mockReverseGeocodeCoords.mockResolvedValueOnce({ status: 'not-configured' });

    const { result } = renderHook(() => useCurrentLocation());
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe('service-down');
  });

  it('no-results → error: no-results', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    mockRequestLocationWithRationale.mockResolvedValueOnce({
      latitude: 1,
      longitude: 2,
      accuracy: 5,
    });
    mockReverseGeocodeCoords.mockResolvedValueOnce({ status: 'no-results' });

    const { result } = renderHook(() => useCurrentLocation());
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe('no-results');
  });

  it('generic error → error: unknown', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    mockRequestLocationWithRationale.mockResolvedValueOnce({
      latitude: 1,
      longitude: 2,
      accuracy: 5,
    });
    mockReverseGeocodeCoords.mockResolvedValueOnce({ status: 'error' });

    const { result } = renderHook(() => useCurrentLocation());
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe('unknown');
  });
});

describe('useCurrentLocation — re-entry guard', () => {
  it('does not stack two fetches when refresh is called twice in flight', async () => {
    mockReadCachedLocation.mockReturnValue(null);
    let resolveBridge: (v: { latitude: number; longitude: number; accuracy: number }) => void = () =>
      undefined;
    mockRequestLocationWithRationale.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveBridge = res;
        }),
    );
    mockReverseGeocodeCoords.mockResolvedValue({
      status: 'ok',
      formattedAddress: 'A',
      components: { city: 'X' },
      cachedAt: 1,
      source: 'google',
    });

    const { result } = renderHook(() => useCurrentLocation());

    // Fire two refresh()es without awaiting — the second must be a no-op.
    await act(async () => {
      const p1 = result.current.refresh();
      const p2 = result.current.refresh();
      resolveBridge({ latitude: 0, longitude: 0, accuracy: 1 });
      await Promise.all([p1, p2]);
    });

    // Only ONE bridge call should have been made, despite two refreshes.
    expect(mockRequestLocationWithRationale).toHaveBeenCalledTimes(1);
  });
});
