/**
 * Phase 4 (Booking Flow Fix v3.1, 2026-05-02): negative-case tests for
 * `detectUnlinkedAccounts`. The existing
 * `src/__tests__/lib/auth/account-linking.test.ts` covers the canonical
 * positive case + a couple of negatives. This file dual-covers the two
 * boundaries that matter most for false-positive banner suppression:
 *
 *   1. providerCount === 1 with only ONE identifier (e.g. email-only,
 *      no phone) — there is no second uid to link, so the banner MUST
 *      NOT render.
 *   2. providerCount === 2 with both identifiers — the user is already
 *      linked, the banner MUST NOT render.
 *
 * A false positive on either boundary leaks an actionable banner into a
 * happy-path session and confuses the user; a false negative (covered by
 * the canonical test) hides the recovery path.
 */
import { describe, it, expect } from 'vitest';
import { detectUnlinkedAccounts } from '@/lib/auth/account-linking';

describe('detectUnlinkedAccounts — false-positive boundary cases', () => {
  it('returns false when providerCount === 1 but only ONE identifier is present (email only)', () => {
    expect(
      detectUnlinkedAccounts({
        hasZeroBookings: true,
        providerCount: 1,
        hasEmail: true,
        hasPhone: false,
      }),
    ).toBe(false);
  });

  it('returns false when providerCount === 2 with both identifiers (already linked)', () => {
    expect(
      detectUnlinkedAccounts({
        hasZeroBookings: true,
        providerCount: 2,
        hasEmail: true,
        hasPhone: true,
      }),
    ).toBe(false);
  });
});
