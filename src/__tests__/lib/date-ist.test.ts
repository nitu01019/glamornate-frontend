/**
 * Phase 2 + 10 (Booking Flow Fix v3.1, 2026-05-02): regression tests for
 * the IST helpers. The legacy `toISOString().slice(0,10)` shifted late-IST
 * dates by one day, so these tests pin the round-trip at the boundaries
 * that historically misbehaved.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  todayIST,
  nowIST,
  formatDateIST,
  istDateAtTimeToUtc,
  detectMidnightDrift,
} from '../../lib/date-ist';
import { withFakeIST, istWallClockToUtc } from '../../test/helpers/withFakeIST';

afterEach(() => {
  vi.useRealTimers();
});

describe('IST helpers — boundary correctness', () => {
  it('todayIST returns the IST date at 23:59 IST', () => {
    withFakeIST('2026-05-02 23:59');
    expect(todayIST()).toBe('2026-05-02');
  });

  it('todayIST returns tomorrow IST at 00:01 IST (NOT yesterday UTC)', () => {
    withFakeIST('2026-05-03 00:01');
    expect(todayIST()).toBe('2026-05-03');
  });

  it('todayIST is stable across the 02:00 IST mark', () => {
    withFakeIST('2026-05-03 02:00');
    expect(todayIST()).toBe('2026-05-03');
  });

  it('istDateAtTimeToUtc rounds to the correct UTC instant', () => {
    // 00:00 IST on 2026-05-02 == 18:30 UTC on 2026-05-01
    expect(istDateAtTimeToUtc('2026-05-02', '00:00').toISOString()).toBe(
      '2026-05-01T18:30:00.000Z',
    );
    // 23:30 IST on 2026-05-02 == 18:00 UTC on 2026-05-02
    expect(istDateAtTimeToUtc('2026-05-02', '23:30').toISOString()).toBe(
      '2026-05-02T18:00:00.000Z',
    );
  });

  it('formatDateIST round-trips with todayIST', () => {
    withFakeIST('2026-05-02 10:00');
    const istNow = nowIST();
    expect(formatDateIST(istNow)).toBe('2026-05-02');
  });
});

describe('detectMidnightDrift', () => {
  it('returns null outside the IST 00:00-05:30 sensitive window', () => {
    withFakeIST('2026-05-02 14:00');
    expect(detectMidnightDrift()).toBeNull();
  });

  it('flags drift inside the sensitive window', () => {
    // 02:00 IST = 20:30 UTC previous day → IST date != UTC date
    const drifted = istWallClockToUtc('2026-05-02 02:00');
    const result = detectMidnightDrift(drifted);
    expect(result).not.toBeNull();
    expect(result).toMatch(/IST=2026-05-02/);
    expect(result).toMatch(/UTC=2026-05-01/);
  });
});
