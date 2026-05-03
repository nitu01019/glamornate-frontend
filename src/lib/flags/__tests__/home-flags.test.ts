/**
 * Unit tests for the Phase-1 Home v2 feature flag helpers.
 *
 * Covers both decoupled flags:
 *   - `HOME_V2_FLAG_NAME` / `isHomeV2Enabled()` — big-tile category grid.
 *   - `HOME_V2_HERO_FLAG_NAME` / `isHomeV2HeroEnabled()` — clean hero carousel.
 *
 * Contract (identical for both):
 *   - The exported constant matches the canonical env var name.
 *   - The checker returns `true` only when the env var equals the exact
 *     string `'1'`.
 *   - Any other value (undefined, '0', 'true', 'yes', whitespace) returns
 *     `false` so the legacy surface stays the safe default.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HOME_V2_FLAG_NAME,
  HOME_V2_HERO_FLAG_NAME,
  isHomeV2Enabled,
  isHomeV2HeroEnabled,
} from '../home-flags';

describe('home-flags', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isHomeV2Enabled (grid flag)', () => {
    it('exposes the canonical env var name', () => {
      expect(HOME_V2_FLAG_NAME).toBe('NEXT_PUBLIC_HOME_V2_GRID');
    });

    it('returns true when the env var is the exact string "1"', () => {
      vi.stubEnv(HOME_V2_FLAG_NAME, '1');
      expect(isHomeV2Enabled()).toBe(true);
    });

    it('returns false when the env var is unset', () => {
      vi.stubEnv(HOME_V2_FLAG_NAME, '');
      expect(isHomeV2Enabled()).toBe(false);
    });

    it('returns false when the env var is "0"', () => {
      vi.stubEnv(HOME_V2_FLAG_NAME, '0');
      expect(isHomeV2Enabled()).toBe(false);
    });

    it('returns false for truthy-looking strings other than "1"', () => {
      const nonCanonical = ['true', 'yes', 'on', 'enabled', ' 1', '1 ', 'TRUE'];
      for (const value of nonCanonical) {
        vi.stubEnv(HOME_V2_FLAG_NAME, value);
        expect(isHomeV2Enabled()).toBe(false);
      }
    });

    it('defaults to false when the env var is explicitly undefined', () => {
      // `stubEnv('', undefined)` removes the stubbed value entirely.
      vi.stubEnv(HOME_V2_FLAG_NAME, undefined as unknown as string);
      expect(isHomeV2Enabled()).toBe(false);
    });
  });

  describe('isHomeV2HeroEnabled (hero flag)', () => {
    it('exposes the canonical env var name', () => {
      expect(HOME_V2_HERO_FLAG_NAME).toBe('NEXT_PUBLIC_HOME_V2_HERO');
    });

    it('returns true when the env var is the exact string "1"', () => {
      vi.stubEnv(HOME_V2_HERO_FLAG_NAME, '1');
      expect(isHomeV2HeroEnabled()).toBe(true);
    });

    it('returns false when the env var is unset', () => {
      vi.stubEnv(HOME_V2_HERO_FLAG_NAME, '');
      expect(isHomeV2HeroEnabled()).toBe(false);
    });

    it('returns false when the env var is "0"', () => {
      vi.stubEnv(HOME_V2_HERO_FLAG_NAME, '0');
      expect(isHomeV2HeroEnabled()).toBe(false);
    });

    it('returns false for truthy-looking strings other than "1"', () => {
      const nonCanonical = ['true', 'yes', 'on', 'enabled', ' 1 ', '1 ', 'TRUE'];
      for (const value of nonCanonical) {
        vi.stubEnv(HOME_V2_HERO_FLAG_NAME, value);
        expect(isHomeV2HeroEnabled()).toBe(false);
      }
    });

    it('defaults to false when the env var is explicitly undefined', () => {
      // `stubEnv('', undefined)` removes the stubbed value entirely.
      vi.stubEnv(HOME_V2_HERO_FLAG_NAME, undefined as unknown as string);
      expect(isHomeV2HeroEnabled()).toBe(false);
    });

    it('does not leak into or from the grid flag', () => {
      vi.stubEnv(HOME_V2_HERO_FLAG_NAME, '1');
      vi.stubEnv(HOME_V2_FLAG_NAME, '0');
      expect(isHomeV2HeroEnabled()).toBe(true);
      expect(isHomeV2Enabled()).toBe(false);
    });
  });
});
