/**
 * withFakeIST — clock injection helper for IST-sensitive tests (Patch DE-1).
 *
 * Many booking-flow tests assert behaviour that depends on the current
 * Asia/Kolkata wall clock (e.g. "today" lookup, lead-time gating). Without
 * a stable clock these tests are flaky on CI runners that default to UTC
 * and on developer machines that default to local time.
 *
 * Use this helper at the top of any spec that needs deterministic IST:
 *
 * ```ts
 * import { withFakeIST } from '@/test/helpers/withFakeIST';
 *
 * describe('booking flow', () => {
 *   beforeEach(() => withFakeIST('2026-05-02 10:30'));
 *   afterEach(() => vi.useRealTimers());
 * });
 * ```
 *
 * The string is interpreted as a wall-clock time in Asia/Kolkata (UTC+5:30,
 * no DST), then converted to a UTC epoch and pinned via Vitest's fake
 * timers. The companion CI patch (DE-2) sets `TZ=UTC` so test runs are
 * platform-independent.
 *
 * Note: `date-fns-tz` is intentionally not imported here — it lands in
 * Wave 2 (W2-A). IST is a fixed offset (+05:30), so manual conversion is
 * sufficient and avoids a forward dependency on a not-yet-installed package.
 */
import { vi } from 'vitest';

/** Asia/Kolkata is fixed at UTC+05:30 — no DST, no historical drift since 1947. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Parse an IST wall-clock string and return the matching UTC `Date`.
 *
 * Accepts the following shapes (all in Asia/Kolkata local time):
 *   - `2026-05-02 10:30`
 *   - `2026-05-02T10:30`
 *   - `2026-05-02 10:30:45`
 *   - `2026-05-02T10:30:45`
 */
export function istWallClockToUtc(istString: string): Date {
  const trimmed = istString.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `withFakeIST: expected IST string like "2026-05-02 10:30", got "${istString}"`,
    );
  }
  const [, y, mo, d, h, mi, s] = match;
  // Build a UTC instant for the given IST wall-clock by subtracting +05:30.
  const utcEpoch = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  return new Date(utcEpoch - IST_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Pin the system clock to a given Asia/Kolkata wall-clock time.
 *
 * Idempotent: calling it twice in the same test silently overrides the
 * previous time. Callers must restore real timers in `afterEach` via
 * `vi.useRealTimers()`.
 */
export function withFakeIST(istString: string): Date {
  const fakeNow = istWallClockToUtc(istString);
  vi.useFakeTimers({ now: fakeNow });
  vi.setSystemTime(fakeNow);
  return fakeNow;
}
