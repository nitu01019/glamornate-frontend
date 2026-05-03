import { describe, expect, it } from 'vitest';

import { relativeTimeFrom, toDate } from '../relative-time';

function secondsAgo(now: Date, seconds: number): Date {
  return new Date(now.getTime() - seconds * 1000);
}

describe('relative-time', () => {
  const NOW = new Date('2026-04-20T12:00:00.000Z');

  describe('toDate', () => {
    it('returns null for null and undefined', () => {
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
    });

    it('returns null for unparseable strings', () => {
      expect(toDate('not-a-date')).toBeNull();
    });

    it('parses ISO strings', () => {
      const d = toDate('2026-04-20T12:00:00.000Z');
      expect(d).not.toBeNull();
      expect(d?.toISOString()).toBe('2026-04-20T12:00:00.000Z');
    });

    it('parses Firestore _seconds maps', () => {
      const d = toDate({ _seconds: 1_713_609_600, _nanoseconds: 0 });
      expect(d).not.toBeNull();
      expect(d instanceof Date).toBe(true);
    });

    it('parses Firestore seconds maps (admin SDK shape)', () => {
      const d = toDate({ seconds: 1_713_609_600 });
      expect(d).not.toBeNull();
    });
  });

  describe('relativeTimeFrom', () => {
    it('returns empty string for unparseable input', () => {
      expect(relativeTimeFrom(null, NOW)).toBe('');
      expect(relativeTimeFrom('garbage', NOW)).toBe('');
    });

    it('returns "just now" under 60 seconds', () => {
      expect(relativeTimeFrom(secondsAgo(NOW, 5), NOW)).toBe('just now');
      expect(relativeTimeFrom(secondsAgo(NOW, 59), NOW)).toBe('just now');
    });

    it('returns "Xm" within the hour', () => {
      expect(relativeTimeFrom(secondsAgo(NOW, 5 * 60), NOW)).toBe('5m');
      expect(relativeTimeFrom(secondsAgo(NOW, 59 * 60), NOW)).toBe('59m');
    });

    it('returns "Xh" within the day', () => {
      expect(relativeTimeFrom(secondsAgo(NOW, 2 * 60 * 60), NOW)).toBe('2h');
      expect(relativeTimeFrom(secondsAgo(NOW, 23 * 60 * 60), NOW)).toBe('23h');
    });

    it('returns "Yesterday" within 48 hours', () => {
      expect(relativeTimeFrom(secondsAgo(NOW, 26 * 60 * 60), NOW)).toBe('Yesterday');
      expect(relativeTimeFrom(secondsAgo(NOW, 47 * 60 * 60), NOW)).toBe('Yesterday');
    });

    it('returns day-of-week within a week', () => {
      const fiveDaysAgo = secondsAgo(NOW, 5 * 24 * 60 * 60);
      const label = relativeTimeFrom(fiveDaysAgo, NOW);
      expect(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).toContain(label);
    });

    it('returns "MMM D" beyond 7 days', () => {
      const fourteenDaysAgo = secondsAgo(NOW, 14 * 24 * 60 * 60);
      const label = relativeTimeFrom(fourteenDaysAgo, NOW);
      // Should match the MMM D pattern (e.g. "Apr 6")
      expect(label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it('collapses future timestamps to "just now"', () => {
      const future = new Date(NOW.getTime() + 30_000);
      expect(relativeTimeFrom(future, NOW)).toBe('just now');
    });
  });
});
