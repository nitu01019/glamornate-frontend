'use client';

/**
 * useDefaultAddress
 * -----------------
 * Exposes the signed-in user's default `SavedAddress`. v3 (location
 * unification, 2026-05-13): now delegates to `useAddresses()` (which
 * subscribes to the `users/{uid}/addresses` subcollection) instead of
 * watching the legacy embedded `users/{uid}.addresses[]` array. Same
 * public API as before — consumers (`HomeLocationRow`, etc.) keep
 * working without code change.
 *
 * Selection rule (mirrors the backend `setDefaultAddress` invariant):
 *   1. If exactly one address has `isDefault === true`, return it.
 *   2. If none (a transient state during a setDefault swap), fall back
 *      to the most-recently-updated address as a sensible default.
 *   3. If the list is empty, return `null` and let the caller render
 *      the zero state ("Add your address").
 *
 * Behavior preserved from the v2 implementation:
 *   - SSR-safe (the underlying `useAddresses` guards `typeof window`).
 *   - Reference-stable: the returned `address` object identity only
 *     changes when the underlying subcollection doc changes — this
 *     hook does NOT re-derive on every render thanks to the `useMemo`.
 *   - Sign-out: `useAddresses` resets to an empty array, this hook
 *     returns `{ address: null, isLoading: false, error: null }`.
 */

import { useMemo } from 'react';
import { useAddresses } from '@/lib/addresses/use-addresses';
import type { SavedAddress } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseDefaultAddressResult {
  readonly address: SavedAddress | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDefaultAddress(): UseDefaultAddressResult {
  const { addresses, isLoading, error } = useAddresses();

  const address = useMemo<SavedAddress | null>(() => {
    if (addresses.length === 0) return null;
    const explicitDefault = addresses.find((a) => a.isDefault === true);
    if (explicitDefault) return explicitDefault;
    // Fallback: most-recently-updated address (or createdAt as tie-breaker).
    return (
      [...addresses].sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt || '';
        const bTime = b.updatedAt || b.createdAt || '';
        return bTime.localeCompare(aTime);
      })[0] ?? null
    );
  }, [addresses]);

  return useMemo<UseDefaultAddressResult>(
    () => ({ address, isLoading, error }),
    [address, isLoading, error],
  );
}

export default useDefaultAddress;
