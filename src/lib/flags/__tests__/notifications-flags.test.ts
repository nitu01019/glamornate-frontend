/**
 * Unit tests for the Phase-2 notifications feed feature flag helper.
 *
 * Covers:
 *   - `NOTIFICATIONS_FEED_V1_FLAG_NAME` constant is exposed and stable.
 *   - `isNotificationsFeedV1Enabled()` returns `true` only when the env var
 *     equals `'1'`.
 *   - Any other value (undefined, '0', 'true', 'yes', whitespace) returns
 *     `false` so the legacy page path stays the safe default.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOTIFICATIONS_FEED_V1_FLAG_NAME,
  isNotificationsFeedV1Enabled,
} from '../notifications-flags';

describe('notifications-flags', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes the canonical env var name', () => {
    expect(NOTIFICATIONS_FEED_V1_FLAG_NAME).toBe('NEXT_PUBLIC_NOTIFICATIONS_FEED_V1');
  });

  it('returns true when the env var is the exact string "1"', () => {
    vi.stubEnv(NOTIFICATIONS_FEED_V1_FLAG_NAME, '1');
    expect(isNotificationsFeedV1Enabled()).toBe(true);
  });

  it('returns false when the env var is unset', () => {
    vi.stubEnv(NOTIFICATIONS_FEED_V1_FLAG_NAME, '');
    expect(isNotificationsFeedV1Enabled()).toBe(false);
  });

  it('returns false when the env var is "0"', () => {
    vi.stubEnv(NOTIFICATIONS_FEED_V1_FLAG_NAME, '0');
    expect(isNotificationsFeedV1Enabled()).toBe(false);
  });

  it('returns false for truthy-looking strings other than "1"', () => {
    const nonCanonical = ['true', 'yes', 'on', 'enabled', ' 1', '1 ', 'TRUE'];
    for (const value of nonCanonical) {
      vi.stubEnv(NOTIFICATIONS_FEED_V1_FLAG_NAME, value);
      expect(isNotificationsFeedV1Enabled()).toBe(false);
    }
  });

  it('defaults to false when the env var is explicitly undefined', () => {
    // `stubEnv('', undefined)` removes the stubbed value entirely.
    vi.stubEnv(NOTIFICATIONS_FEED_V1_FLAG_NAME, undefined as unknown as string);
    expect(isNotificationsFeedV1Enabled()).toBe(false);
  });
});
