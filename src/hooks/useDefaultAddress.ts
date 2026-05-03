'use client';

/**
 * useDefaultAddress
 * -----------------
 * Subscribes to the current user's `users/{uid}` document and exposes the
 * `SavedAddress` where `isDefault === true`.
 *
 * Behavior:
 *  - **SSR-safe.** On the server pass (`typeof window === 'undefined'`) returns
 *    `{ address: null, isLoading: true, error: null }` without touching
 *    Firestore. The listener only attaches inside a browser `useEffect`.
 *  - **Sign-out handling.** When `firebaseUser` transitions to `null`, the
 *    effect cleanup runs synchronously (unsubscribes the previous listener)
 *    and the hook resets to `{ address: null, isLoading: false, error: null }`.
 *  - **Permission-denied swallow.** Firestore fires a transient
 *    `permission-denied` error between the `onAuthStateChanged(null)` event
 *    and the listener teardown — we swallow that specific code and treat it
 *    as a normal signed-out state.
 *  - **Fast Refresh double-subscribe guard.** The effect depends only on
 *    `firebaseUser?.uid`; React's effect cleanup unsubscribes the previous
 *    listener before a new one is attached, so hot reloads never stack
 *    listeners.
 *  - **Memoization.** The returned `address` object reference is stable across
 *    snapshots when the underlying JSON has not changed — consumers can use
 *    it as a `useEffect` dependency without thrashing.
 *
 * Schema assumption:
 *  The `SavedAddress` type (`src/types/index.ts`) does not include a
 *  `deletedAt` field — saved addresses are hard-deleted from the array in
 *  `src/app/customer/addresses/page.tsx` (handleDelete). The "soft-delete
 *  fallback" path described in the autoplan (Eng F2) is therefore a no-op
 *  against today's canonical schema, but the implementation tolerates a
 *  `deletedAt` marker on legacy documents so the fallback kicks in
 *  automatically if the type ever grows that field.
 *
 * Other Firestore errors (`unavailable`, `deadline-exceeded`, etc.) surface
 * via the `error` field as the raw `FirebaseError` for caller inspection.
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import { useAuth } from '@/lib/auth-provider';
import type { SavedAddress } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseDefaultAddressResult {
  readonly address: SavedAddress | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

/**
 * `SavedAddress` augmented with an optional `deletedAt` marker. The canonical
 * `SavedAddress` type does not declare this field today, but Firestore may
 * return it on legacy documents — tolerating it keeps the fallback logic
 * schema-stable.
 */
interface SavedAddressWithSoftDelete extends SavedAddress {
  readonly deletedAt?: string | null;
}

interface UserDocLike extends DocumentData {
  readonly addresses?: readonly SavedAddressWithSoftDelete[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Treat an address as live when it either has no `deletedAt` field (the
 * canonical schema) or `deletedAt` is explicitly `null` / `undefined`.
 */
function isLive(addr: SavedAddressWithSoftDelete): boolean {
  return addr.deletedAt == null;
}

/**
 * Select the default address from the array, with a soft-delete fallback to
 * the most-recently created non-deleted address when the default itself is
 * soft-deleted. Returns `null` if the array is empty or every candidate is
 * soft-deleted.
 */
function pickDefault(
  addresses: readonly SavedAddressWithSoftDelete[] | undefined,
): SavedAddress | null {
  if (!addresses || addresses.length === 0) return null;

  const explicitDefault = addresses.find((a) => a.isDefault === true);

  if (explicitDefault && isLive(explicitDefault)) {
    return stripSoftDeleteMarker(explicitDefault);
  }

  // Soft-delete fallback: default is tombstoned (or missing) — pick the most
  // recently created live address.
  const liveAddresses = addresses.filter(isLive);
  if (liveAddresses.length === 0) return null;

  const mostRecent = liveAddresses.reduce((acc, cur) =>
    (cur.createdAt ?? '') > (acc.createdAt ?? '') ? cur : acc,
  );

  return stripSoftDeleteMarker(mostRecent);
}

function stripSoftDeleteMarker(addr: SavedAddressWithSoftDelete): SavedAddress {
  // `deletedAt` is a non-canonical field — strip before returning so consumers
  // get a clean `SavedAddress`. Object rest excludes the marker without
  // mutating the source.
  const { deletedAt: _deletedAt, ...rest } = addr;
  void _deletedAt;
  return rest;
}

/**
 * Shallow-stable JSON signature of a SavedAddress — used to avoid allocating
 * a new object reference when the snapshot echoes identical data (common with
 * Firestore's local-cache optimistic writes).
 */
function addressSignature(addr: SavedAddress | null): string {
  return addr ? JSON.stringify(addr) : '';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to the signed-in user's default `SavedAddress`.
 *
 * @returns `{ address, isLoading, error }` — see module docblock for the full
 *   behavior spec (SSR, sign-out, permission-denied, memoization).
 */
export function useDefaultAddress(): UseDefaultAddressResult {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // Server pass & first client paint before auth resolves: loading + null.
  // `isLoading` starts `true` so consumers can render a skeleton without a
  // flash of "no address" during the auth round-trip.
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // SSR guard — this branch can be reached on the hydration pass before
    // `window` is defined in some test environments.
    if (typeof window === 'undefined') {
      return;
    }

    // No authenticated user: reset to the signed-out steady state
    // synchronously inside the effect body (NOT the cleanup callback) so the
    // transition from signed-in → signed-out is observable in one render.
    if (!uid) {
      setAddress(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // New subscription — flip to loading while the first snapshot arrives.
    setIsLoading(true);
    setError(null);

    const db = getFirebaseFirestore();
    const userRef = doc(db, 'users', uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.data() as UserDocLike) : undefined;
        const next = pickDefault(data?.addresses);

        // Shallow compare via JSON signature to keep the reference stable when
        // Firestore emits an echo snapshot with identical data.
        setAddress((prev) => (addressSignature(prev) === addressSignature(next) ? prev : next));
        setError(null);
        setIsLoading(false);
      },
      (snapshotError: FirebaseError) => {
        // Swallow the transient `permission-denied` that fires between
        // sign-out and the listener teardown — it's a race, not a real error.
        if (snapshotError.code === 'permission-denied') {
          setAddress(null);
          setError(null);
          setIsLoading(false);
          return;
        }
        setError(snapshotError);
        setIsLoading(false);
      },
    );

    // Cleanup runs synchronously on unmount / dep change, which means the
    // previous listener is torn down before a new one is attached during
    // Fast Refresh or an auth transition.
    return () => {
      unsubscribe();
    };
  }, [uid]);

  // Return a memoized object so consumers that spread / destructure don't see
  // a new identity on every render unless something actually changed.
  return useMemo<UseDefaultAddressResult>(
    () => ({ address, isLoading, error }),
    [address, isLoading, error],
  );
}

export default useDefaultAddress;
