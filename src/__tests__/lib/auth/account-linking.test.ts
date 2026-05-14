/**
 * Phase 4 (Booking Flow Fix v3.1, 2026-05-02): regression tests for the
 * account-linking helpers. The unlinked-banner heuristic and the
 * `auth/account-exists-with-different-credential` recovery branch are
 * the two paths that ship customer-visible behaviour.
 */
import { describe, it, expect } from 'vitest';
import { detectUnlinkedAccounts, resolveLinkConflict } from '../../../auth/account-linking';

describe('detectUnlinkedAccounts', () => {
  it('returns true for the canonical zero-bookings + email + phone case', () => {
    expect(
      detectUnlinkedAccounts({
        hasZeroBookings: true,
        providerCount: 1,
        hasEmail: true,
        hasPhone: true,
      }),
    ).toBe(true);
  });

  it('returns false when the user has bookings', () => {
    expect(
      detectUnlinkedAccounts({
        hasZeroBookings: false,
        providerCount: 1,
        hasEmail: true,
        hasPhone: true,
      }),
    ).toBe(false);
  });

  it('returns false with multiple providers (already linked)', () => {
    expect(
      detectUnlinkedAccounts({
        hasZeroBookings: true,
        providerCount: 2,
        hasEmail: true,
        hasPhone: true,
      }),
    ).toBe(false);
  });

  it('returns false when only one identifier is present', () => {
    expect(
      detectUnlinkedAccounts({
        hasZeroBookings: true,
        providerCount: 1,
        hasEmail: true,
        hasPhone: false,
      }),
    ).toBe(false);
  });
});

describe('resolveLinkConflict', () => {
  it('returns no_action_required for unrelated errors', async () => {
    const out = await resolveLinkConflict(new Error('unrelated'));
    expect(out.kind).toBe('no_action_required');
  });

  it('returns no_action_required when the conflict is missing email or credential', async () => {
    const err = { code: 'auth/account-exists-with-different-credential' };
    const out = await resolveLinkConflict(err);
    expect(out.kind).toBe('no_action_required');
  });
});
