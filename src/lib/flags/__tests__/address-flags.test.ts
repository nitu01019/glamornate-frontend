/**
 * Unit tests for the Phase-2 address-sheet v2 feature flag helper.
 *
 * Covers:
 *   - `ADDRESS_SHEET_V2_FLAG_NAME` constant is exposed and stable.
 *   - `isAddressSheetV2Enabled()` returns `true` only when the env var
 *     equals `'1'`.
 *   - Any other value (undefined, '0', 'true', 'yes', whitespace) returns
 *     `false` so the legacy deep-link-to-CRUD path stays the safe default.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ADDRESS_SHEET_V2_FLAG_NAME,
  isAddressSheetV2Enabled,
} from '../address-flags';

describe('address-flags', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes the canonical env var name', () => {
    expect(ADDRESS_SHEET_V2_FLAG_NAME).toBe('NEXT_PUBLIC_ADDRESS_SHEET_V2');
  });

  it('returns true when the env var is the exact string "1"', () => {
    vi.stubEnv(ADDRESS_SHEET_V2_FLAG_NAME, '1');
    expect(isAddressSheetV2Enabled()).toBe(true);
  });

  it('returns false when the env var is unset', () => {
    vi.stubEnv(ADDRESS_SHEET_V2_FLAG_NAME, '');
    expect(isAddressSheetV2Enabled()).toBe(false);
  });

  it('returns false when the env var is "0"', () => {
    vi.stubEnv(ADDRESS_SHEET_V2_FLAG_NAME, '0');
    expect(isAddressSheetV2Enabled()).toBe(false);
  });

  it('returns false for truthy-looking strings other than "1"', () => {
    const nonCanonical = ['true', 'yes', 'on', 'enabled', ' 1', '1 ', 'TRUE'];
    for (const value of nonCanonical) {
      vi.stubEnv(ADDRESS_SHEET_V2_FLAG_NAME, value);
      expect(isAddressSheetV2Enabled()).toBe(false);
    }
  });

  it('defaults to false when the env var is explicitly undefined', () => {
    // `stubEnv('', undefined)` removes the stubbed value entirely.
    vi.stubEnv(ADDRESS_SHEET_V2_FLAG_NAME, undefined as unknown as string);
    expect(isAddressSheetV2Enabled()).toBe(false);
  });
});
