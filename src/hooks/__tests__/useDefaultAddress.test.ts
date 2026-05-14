/**
 * Tests for `useDefaultAddress`.
 *
 * v3 (2026-05-13 — location unification): `useDefaultAddress` now
 * delegates to `useAddresses()` instead of subscribing to the legacy
 * `users/{uid}.addresses[]` embedded array. These tests mock the
 * delegate and verify the selection rule:
 *   1. Prefer the address with `isDefault === true`.
 *   2. Fall back to the most-recently-updated address.
 *   3. Return `null` when the list is empty.
 *
 * SSR + sign-out + snapshot-error semantics are now owned by
 * `useAddresses` and covered in `use-addresses.test.tsx` — this file
 * only verifies the pure selection logic on top.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SavedAddress } from '@/types';
import type { UseAddressesResult } from '@/lib/addresses/use-addresses';

// ---------------------------------------------------------------------------
// useAddresses mock — captures the returned value per render.
// ---------------------------------------------------------------------------

const { mockUseAddresses } = vi.hoisted(() => ({
  mockUseAddresses: vi.fn(),
}));

vi.mock('@/lib/addresses/use-addresses', () => ({
  useAddresses: () => mockUseAddresses() as UseAddressesResult,
}));

import { useDefaultAddress } from '../useDefaultAddress';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: 'addr-1',
    label: 'home',
    name: 'Test User',
    phone: '9999999999',
    flatHouse: '101',
    street: 'MG Road',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockResult(
  overrides: Partial<UseAddressesResult> & { addresses: readonly SavedAddress[] },
): UseAddressesResult {
  return {
    list: { data: overrides.addresses, isLoading: false, error: null },
    addresses: overrides.addresses,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    // Mutation surfaces — tests don't invoke them, so light stubs suffice.
    addAddress: { mutateAsync: vi.fn() } as never,
    updateAddress: { mutateAsync: vi.fn() } as never,
    deleteAddress: { mutateAsync: vi.fn() } as never,
    setDefaultAddress: { mutateAsync: vi.fn() } as never,
    migrationState: 'done',
  } as UseAddressesResult;
}

beforeEach(() => {
  mockUseAddresses.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDefaultAddress — selection rule', () => {
  it('returns null when the address list is empty', () => {
    mockUseAddresses.mockReturnValue(mockResult({ addresses: [] }));
    const { result } = renderHook(() => useDefaultAddress());
    expect(result.current.address).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns the explicit default when one address has isDefault: true', () => {
    const addresses = [
      mockAddress({ id: 'a', isDefault: false }),
      mockAddress({ id: 'b', isDefault: true }),
      mockAddress({ id: 'c', isDefault: false }),
    ];
    mockUseAddresses.mockReturnValue(mockResult({ addresses }));
    const { result } = renderHook(() => useDefaultAddress());
    expect(result.current.address?.id).toBe('b');
  });

  it('falls back to the most-recently-updated address when no explicit default', () => {
    const addresses = [
      mockAddress({ id: 'a', updatedAt: '2026-01-01T00:00:00Z' }),
      mockAddress({ id: 'b', updatedAt: '2026-03-15T00:00:00Z' }),
      mockAddress({ id: 'c', updatedAt: '2026-02-01T00:00:00Z' }),
    ];
    mockUseAddresses.mockReturnValue(mockResult({ addresses }));
    const { result } = renderHook(() => useDefaultAddress());
    expect(result.current.address?.id).toBe('b');
  });

  it('propagates isLoading from the delegate', () => {
    mockUseAddresses.mockReturnValue(mockResult({ addresses: [], isLoading: true }));
    const { result } = renderHook(() => useDefaultAddress());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.address).toBeNull();
  });

  it('propagates error from the delegate', () => {
    const err = new Error('network');
    mockUseAddresses.mockReturnValue(mockResult({ addresses: [], error: err }));
    const { result } = renderHook(() => useDefaultAddress());
    expect(result.current.error).toBe(err);
  });

  it('returns a stable result reference when inputs are identical', () => {
    const addresses = [mockAddress({ id: 'a', isDefault: true })];
    mockUseAddresses.mockReturnValue(mockResult({ addresses }));
    const { result, rerender } = renderHook(() => useDefaultAddress());
    const first = result.current;
    // Same delegate output → same selected address reference.
    mockUseAddresses.mockReturnValue(mockResult({ addresses }));
    rerender();
    expect(result.current.address).toBe(first.address);
  });

  it('falls back to createdAt when both addresses have empty updatedAt', () => {
    const addresses = [
      mockAddress({ id: 'a', updatedAt: '', createdAt: '2026-01-01T00:00:00Z' }),
      mockAddress({ id: 'b', updatedAt: '', createdAt: '2026-04-01T00:00:00Z' }),
    ];
    mockUseAddresses.mockReturnValue(mockResult({ addresses }));
    const { result } = renderHook(() => useDefaultAddress());
    expect(result.current.address?.id).toBe('b');
  });
});
