/**
 * Tests for capacitor-bridge.ts
 *
 * Contracts under test (post Agent-1/2 edits):
 *
 *   (1) getCurrentPosition() does NOT call Geolocation.requestPermissions()
 *       standalone — permission pre-check must be removed so the plugin's
 *       own internal permission-request lifecycle runs correctly.
 *
 *   (2) When the plugin throws a permission-denied error,
 *       getCurrentPosition() rejects with LocationPermissionDeniedError
 *       (message: string, isPermanentlyDenied: boolean).
 *       isPermanentlyDenied is true when checkPermissions() still returns
 *       'denied' after the failed call (Android USER_FIXED / "Don't ask
 *       again" scenario).
 *
 *   (3) normalizePermissionState('prompt-with-rationale') returns
 *       'prompt-with-rationale' — the new case must NOT collapse to 'prompt'.
 *
 *   (4) requestLocationWithRationale() rejects with LocationPermissionDeniedError
 *       where .needsRationale === true when checkPermissions() returns
 *       'prompt-with-rationale', so callers can show a rationale modal.
 *
 * All Capacitor and platform dependencies are fully mocked — tests never
 * touch the network or the native layer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock fn references — must be declared before vi.mock() factories
// because vi.mock calls are hoisted to file top by Vitest's babel transform.
// ---------------------------------------------------------------------------

const {
  mockCheckPermissions,
  mockRequestPermissions,
  mockGetCurrentPosition,
} = vi.hoisted(() => ({
  mockCheckPermissions: vi.fn(),
  mockRequestPermissions: vi.fn(),
  mockGetCurrentPosition: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @capacitor/geolocation
//
// The bridge imports this module dynamically (`await import(...)`) inside
// loadCapacitorPlugin(). Vitest intercepts dynamic imports with vi.mock too,
// so this single declaration is enough to control all plugin calls.
// ---------------------------------------------------------------------------

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: mockCheckPermissions,
    requestPermissions: mockRequestPermissions,
    getCurrentPosition: mockGetCurrentPosition,
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/capacitor so that isNative() returns true, which routes all
// calls through the 'capacitor-native' code path in the bridge.
// ---------------------------------------------------------------------------

vi.mock('@/lib/capacitor', () => ({
  isNative: vi.fn(() => true),
  isCapacitor: vi.fn(() => true),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER vi.mock declarations so the mocked
// modules are in place when the bridge module initialises.
// ---------------------------------------------------------------------------

import {
  getCurrentPosition,
  checkLocationPermission,
  requestLocationWithRationale,
  LocationPermissionDeniedError,
} from '../capacitor-bridge';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FAKE_COORDS = {
  latitude: 12.9716,
  longitude: 77.5946,
  accuracy: 5,
};

const FAKE_POSITION = { coords: FAKE_COORDS };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('capacitor-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getCurrentPosition()
  // -------------------------------------------------------------------------

  describe('getCurrentPosition()', () => {
    it('does NOT call Geolocation.requestPermissions() standalone', async () => {
      // Arrange — permissions are 'granted' so no pre-check path is needed,
      // and the position resolves immediately.
      mockCheckPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
      mockGetCurrentPosition.mockResolvedValue(FAKE_POSITION);
      mockRequestPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });

      // Act
      await getCurrentPosition({});

      // Assert — requestPermissions must NOT have been called at any point
      // during the getCurrentPosition() call chain.
      expect(mockRequestPermissions).not.toHaveBeenCalled();
    });

    it('resolves with BridgeCoords on success', async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
      mockGetCurrentPosition.mockResolvedValue(FAKE_POSITION);

      const result = await getCurrentPosition({});

      expect(result).toEqual(FAKE_COORDS);
    });

    it('throws LocationPermissionDeniedError when plugin throws permission-denied error', async () => {
      // Arrange — plugin rejects with a "User denied" message.
      mockGetCurrentPosition.mockRejectedValue(new Error('User denied location permission'));
      // After the failure, checkPermissions() still reports 'denied' →
      // indicates permanent denial (Android USER_FIXED).
      mockCheckPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

      // Act + Assert
      await expect(getCurrentPosition({})).rejects.toThrow(LocationPermissionDeniedError);
    });

    it('sets isPermanentlyDenied=true when checkPermissions returns denied after plugin throws', async () => {
      mockGetCurrentPosition.mockRejectedValue(new Error('User denied location permission'));
      mockCheckPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

      let thrownError: unknown;
      try {
        await getCurrentPosition({});
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(LocationPermissionDeniedError);
      expect((thrownError as LocationPermissionDeniedError).isPermanentlyDenied).toBe(true);
    });

    it('sets isPermanentlyDenied=false when checkPermissions returns prompt after plugin throws', async () => {
      // First denial — dialog appeared but was dismissed; not permanently
      // denied because the state is now 'prompt' again.
      mockGetCurrentPosition.mockRejectedValue(new Error('User denied location permission'));
      mockCheckPermissions.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });

      let thrownError: unknown;
      try {
        await getCurrentPosition({});
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(LocationPermissionDeniedError);
      expect((thrownError as LocationPermissionDeniedError).isPermanentlyDenied).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // normalizePermissionState (behaviour tested via checkLocationPermission)
  //
  // normalizePermissionState is a private helper. We test its contract
  // through checkLocationPermission(), which is the public API that proxies
  // the raw plugin state through the normaliser.
  // -------------------------------------------------------------------------

  describe('normalizePermissionState (via checkLocationPermission)', () => {
    it("passes 'prompt-with-rationale' through unchanged", async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'prompt-with-rationale' });
      const result = await checkLocationPermission();
      expect(result).toBe('prompt-with-rationale');
    });

    it("passes 'granted' through unchanged", async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'granted' });
      const result = await checkLocationPermission();
      expect(result).toBe('granted');
    });

    it("passes 'denied' through unchanged", async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'denied' });
      const result = await checkLocationPermission();
      expect(result).toBe('denied');
    });

    it("passes 'prompt' through unchanged", async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'prompt' });
      const result = await checkLocationPermission();
      expect(result).toBe('prompt');
    });

    it("maps unrecognized state to 'unknown'", async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'some-future-state' });
      const result = await checkLocationPermission();
      expect(result).toBe('unknown');
    });

    it("returns 'unknown' when checkPermissions throws", async () => {
      mockCheckPermissions.mockRejectedValue(new Error('plugin error'));
      const result = await checkLocationPermission();
      expect(result).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // requestLocationWithRationale()
  // -------------------------------------------------------------------------

  describe('requestLocationWithRationale()', () => {
    it("throws LocationPermissionDeniedError with needsRationale=true when state is 'prompt-with-rationale'", async () => {
      mockCheckPermissions.mockResolvedValue({
        location: 'prompt-with-rationale',
        coarseLocation: 'prompt-with-rationale',
      });

      let thrownError: unknown;
      try {
        await requestLocationWithRationale();
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(LocationPermissionDeniedError);
      expect((thrownError as LocationPermissionDeniedError & { needsRationale: boolean }).needsRationale).toBe(true);
    });

    it("resolves with BridgeCoords when permission is 'granted'", async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
      mockGetCurrentPosition.mockResolvedValue(FAKE_POSITION);

      const result = await requestLocationWithRationale();

      expect(result).toEqual(FAKE_COORDS);
    });

    it("throws LocationPermissionDeniedError with isPermanentlyDenied=true when state is 'denied'", async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

      let thrownError: unknown;
      try {
        await requestLocationWithRationale();
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(LocationPermissionDeniedError);
      expect((thrownError as LocationPermissionDeniedError).isPermanentlyDenied).toBe(true);
    });

    it('does not call Geolocation.requestPermissions() standalone', async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
      mockGetCurrentPosition.mockResolvedValue(FAKE_POSITION);

      await requestLocationWithRationale();

      expect(mockRequestPermissions).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // LocationPermissionDeniedError
  //
  // Constructor signature: (message: string, isPermanentlyDenied: boolean)
  // -------------------------------------------------------------------------

  describe('LocationPermissionDeniedError', () => {
    it('is an instance of Error', () => {
      const err = new LocationPermissionDeniedError('Location permission denied', false);
      expect(err).toBeInstanceOf(Error);
    });

    it('carries isPermanentlyDenied=true', () => {
      const err = new LocationPermissionDeniedError('Location permission denied', true);
      expect(err.isPermanentlyDenied).toBe(true);
    });

    it('carries isPermanentlyDenied=false', () => {
      const err = new LocationPermissionDeniedError('Location permission denied', false);
      expect(err.isPermanentlyDenied).toBe(false);
    });

    it('has correct name property', () => {
      const err = new LocationPermissionDeniedError('Location permission denied', false);
      expect(err.name).toBe('LocationPermissionDeniedError');
    });

    it('surfaces the provided message', () => {
      const err = new LocationPermissionDeniedError('Location permission denied', false);
      expect(err.message).toBe('Location permission denied');
    });

    it('surfaces rationale-required message variant', () => {
      const err = new LocationPermissionDeniedError('rationale-required', false);
      expect(err.message).toBe('rationale-required');
    });
  });
});
