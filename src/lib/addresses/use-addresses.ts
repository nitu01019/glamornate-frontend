'use client';

/**
 * use-addresses
 * -------------
 * React Query wrapper over Phase 4A's address callables and the live
 * `users/{uid}/addresses` subcollection.
 *
 * Callables (contract: backend/functions/src/callable/addAddress.ts):
 *   - addAddress({ label, name, phone, flatHouse, street, landmark?, city,
 *                  state, pincode, isDefault?, geo? })
 *       → { addressId, isDefault }
 *   - updateAddress({ addressId, patch })
 *       → { addressId, isDefault }
 *   - deleteAddress({ addressId })
 *       → { deleted: true, promotedDefault?: string }
 *   - setDefaultAddress({ addressId })
 *       → { addressId }
 *   - migrateAddressesToSubcollection()
 *       → { migrated, alreadyDone }
 *
 * The list query subscribes to `users/{uid}/addresses` via a background
 * `onSnapshot`, mirroring the session-live data into the React Query cache
 * so that mutations and snapshot updates stay deterministic.
 *
 * A one-time migration (`migrateAddressesToSubcollection()`) is fired on
 * first mount per session, guarded by a module-scoped sentinel so
 * concurrent consumers (multiple `useAddresses()` calls in the same tab)
 * never double-invoke.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { collection, onSnapshot, query, type FirestoreError } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '@/lib/auth-provider';
import { getFirebaseApp, getFirebaseFirestore } from '@/lib/firebase-client';
import { logger } from '@/lib/logger';
import type { AddressLabel, ManualAddressLabel, SavedAddress } from '@/types';

const log = logger.child({ component: 'useAddresses' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FUNCTIONS_REGION = 'us-central1';

export const addressesQueryKey = (uid: string | null): readonly string[] =>
  ['addresses', uid ?? 'anonymous'] as const;

// ---------------------------------------------------------------------------
// Callable payload types (mirror backend Phase 4A exactly)
// ---------------------------------------------------------------------------

export interface GeoInput {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy?: number;
}

export interface AddAddressInput {
  readonly label: AddressLabel;
  readonly name: string;
  readonly phone: string;
  readonly flatHouse: string;
  readonly street: string;
  readonly landmark?: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  readonly isDefault?: boolean;
  readonly geo?: GeoInput;
}

export interface AddAddressResponse {
  readonly addressId: string;
  readonly isDefault: boolean;
}

/**
 * Patch shape — matches backend `AddressPatchSchema`. `label` is narrowed to
 * `ManualAddressLabel` because patching an address TO `'detected'` is
 * server-rejected (would let a malicious client convert any saved address
 * into a pruneable GPS-auto-save entry). Promoting a `'detected'` entry
 * to home/work IS allowed; the user re-categorises by editing the entry,
 * not by patching the existing one to `'detected'`.
 */
export type AddressPatch = Partial<
  Omit<AddAddressInput, 'isDefault' | 'label'> & { label: ManualAddressLabel }
>;

export interface UpdateAddressInput {
  readonly addressId: string;
  readonly patch: AddressPatch;
}

export interface UpdateAddressResponse {
  readonly addressId: string;
  readonly isDefault: boolean;
}

export interface DeleteAddressInput {
  readonly addressId: string;
}

export interface DeleteAddressResponse {
  readonly deleted: true;
  readonly promotedDefault?: string | null;
}

export interface SetDefaultAddressInput {
  readonly addressId: string;
}

export interface SetDefaultAddressResponse {
  readonly addressId: string;
}

export interface MigrationResponse {
  readonly migrated: number;
  readonly alreadyDone: boolean;
}

// ---------------------------------------------------------------------------
// Session-level migration guard — only runs once per browser tab session.
// ---------------------------------------------------------------------------

type MigrationState = 'pending' | 'in-flight' | 'done' | 'errored';

interface MigrationGate {
  state: MigrationState;
  promise: Promise<MigrationResponse | null> | null;
}

const migrationGate: Record<string, MigrationGate> = {};

function getMigrationGate(uid: string): MigrationGate {
  if (!migrationGate[uid]) {
    migrationGate[uid] = { state: 'pending', promise: null };
  }
  return migrationGate[uid];
}

/**
 * Test-only helper: reset the in-memory migration gate so repeated tests
 * can re-exercise the one-time migration path without bleeding state.
 */
export function __resetMigrationGateForTests(): void {
  for (const key of Object.keys(migrationGate)) {
    delete migrationGate[key];
  }
}

// ---------------------------------------------------------------------------
// Callable invokers (pure functions — easy to mock)
// ---------------------------------------------------------------------------

function invokeCallable<TReq, TRes>(name: string) {
  return async (payload: TReq): Promise<TRes> => {
    const fns = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
    const call = httpsCallable<TReq, TRes>(fns, name);
    const res = await call(payload);
    return res.data;
  };
}

export const addAddressCallable = (input: AddAddressInput): Promise<AddAddressResponse> =>
  invokeCallable<AddAddressInput, AddAddressResponse>('addAddress')(input);

export const updateAddressCallable = (input: UpdateAddressInput): Promise<UpdateAddressResponse> =>
  invokeCallable<UpdateAddressInput, UpdateAddressResponse>('updateAddress')(input);

export const deleteAddressCallable = (input: DeleteAddressInput): Promise<DeleteAddressResponse> =>
  invokeCallable<DeleteAddressInput, DeleteAddressResponse>('deleteAddress')(input);

export const setDefaultAddressCallable = (
  input: SetDefaultAddressInput,
): Promise<SetDefaultAddressResponse> =>
  invokeCallable<SetDefaultAddressInput, SetDefaultAddressResponse>('setDefaultAddress')(input);

export const migrateAddressesCallable = (): Promise<MigrationResponse> =>
  invokeCallable<Record<string, never>, MigrationResponse>('migrateAddressesToSubcollection')(
    {} as Record<string, never>,
  );

/**
 * Injectable surface used by tests / Storybook to swap the 5 callables with
 * stubs. Production consumers should pass `undefined` so the real Firebase
 * callables are used.
 */
export interface AddressesCallables {
  readonly addAddress: typeof addAddressCallable;
  readonly updateAddress: typeof updateAddressCallable;
  readonly deleteAddress: typeof deleteAddressCallable;
  readonly setDefaultAddress: typeof setDefaultAddressCallable;
  readonly migrateAddressesToSubcollection: typeof migrateAddressesCallable;
}

const defaultCallables: AddressesCallables = {
  addAddress: addAddressCallable,
  updateAddress: updateAddressCallable,
  deleteAddress: deleteAddressCallable,
  setDefaultAddress: setDefaultAddressCallable,
  migrateAddressesToSubcollection: migrateAddressesCallable,
};

// ---------------------------------------------------------------------------
// Subcollection snapshot → React Query mirror
// ---------------------------------------------------------------------------

interface FirestoreAddressDoc extends Omit<SavedAddress, 'createdAt' | 'updatedAt'> {
  readonly createdAt?: string | { toMillis?: () => number } | null;
  readonly updatedAt?: string | { toMillis?: () => number } | null;
}

function normaliseTimestamp(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as { toMillis?: () => number; seconds?: number };
    if (typeof obj.toMillis === 'function') {
      return new Date(obj.toMillis()).toISOString();
    }
    if (typeof obj.seconds === 'number') {
      return new Date(obj.seconds * 1000).toISOString();
    }
  }
  return '';
}

function toSavedAddress(id: string, raw: FirestoreAddressDoc): SavedAddress {
  const addr: SavedAddress = {
    id,
    label: raw.label,
    name: raw.name,
    phone: raw.phone,
    flatHouse: raw.flatHouse,
    street: raw.street,
    city: raw.city,
    state: raw.state,
    pincode: raw.pincode,
    isDefault: raw.isDefault === true,
    createdAt: normaliseTimestamp(raw.createdAt),
    updatedAt: normaliseTimestamp(raw.updatedAt),
  };
  if (typeof raw.landmark === 'string' && raw.landmark.length > 0) {
    return { ...addr, landmark: raw.landmark };
  }
  return addr;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseAddressesOptions {
  /** Injectable callables for tests; defaults to real Firebase callables. */
  readonly callables?: Partial<AddressesCallables>;
  /**
   * Disable the one-time migration call on mount. Defaults to `true` — pass
   * `false` only from tests that want to skip it.
   */
  readonly runMigration?: boolean;
}

export interface UseAddressesResult {
  readonly list: {
    readonly data: readonly SavedAddress[];
    readonly isLoading: boolean;
    readonly error: Error | null;
  };
  readonly addresses: readonly SavedAddress[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly addAddress: UseMutationResult<AddAddressResponse, Error, AddAddressInput>;
  readonly updateAddress: UseMutationResult<UpdateAddressResponse, Error, UpdateAddressInput>;
  readonly deleteAddress: UseMutationResult<DeleteAddressResponse, Error, DeleteAddressInput>;
  readonly setDefaultAddress: UseMutationResult<
    SetDefaultAddressResponse,
    Error,
    SetDefaultAddressInput
  >;
  readonly migrationState: MigrationState;
}

/**
 * Subscribe to the signed-in user's saved addresses and expose mutation
 * hooks for the four CRUD callables.
 *
 * The returned `list` is live: Firestore `onSnapshot` populates the query
 * cache directly so downstream consumers re-render on any server-side
 * change (other devices, callable side-effects, etc).
 */
export function useAddresses(options: UseAddressesOptions = {}): UseAddressesResult {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const queryClient = useQueryClient();

  const callables = useMemo<AddressesCallables>(
    () => ({
      ...defaultCallables,
      ...(options.callables ?? {}),
    }),
    [options.callables],
  );
  const runMigration = options.runMigration ?? true;

  // Local state mirrors the live Firestore subcollection. The React Query
  // cache gets a synchronised copy so any consumer that wants to read the
  // list through `useQueryClient().getQueryData` sees the same thing.
  const [addresses, setAddressesState] = useState<readonly SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(uid));
  const [snapshotError, setSnapshotError] = useState<Error | null>(null);

  // ---- Live snapshot bridge ---------------------------------------------
  useEffect(() => {
    if (!uid) {
      setAddressesState([]);
      setIsLoading(false);
      return;
    }
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    setSnapshotError(null);

    const db = getFirebaseFirestore();
    const subRef = query(collection(db, 'users', uid, 'addresses'));

    const unsubscribe = onSnapshot(
      subRef,
      (snap) => {
        const next: SavedAddress[] = snap.docs.map((d) =>
          toSavedAddress(d.id, d.data() as FirestoreAddressDoc),
        );
        // Sort: default first, then updatedAt desc, then createdAt desc.
        next.sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
          const cmp = (b.updatedAt || '').localeCompare(a.updatedAt || '');
          if (cmp !== 0) return cmp;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        setAddressesState(next);
        setIsLoading(false);
        queryClient.setQueryData<readonly SavedAddress[]>(addressesQueryKey(uid), next);
      },
      (err: FirestoreError) => {
        log.warn('Addresses subscription error', { code: err.code });
        setSnapshotError(new Error(err.message || err.code));
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [uid, queryClient]);

  // ---- One-time migration ------------------------------------------------
  const [migrationState, setMigrationState] = useState<MigrationState>(() => {
    if (!uid) return 'pending';
    return getMigrationGate(uid).state;
  });

  useEffect(() => {
    if (!runMigration) return;
    if (!uid) return;

    const gate = getMigrationGate(uid);
    setMigrationState(gate.state);
    if (gate.state !== 'pending') return;

    gate.state = 'in-flight';
    setMigrationState('in-flight');
    gate.promise = callables
      .migrateAddressesToSubcollection()
      .then((result) => {
        gate.state = 'done';
        setMigrationState('done');
        log.info('Address migration complete', {
          migrated: result.migrated,
          alreadyDone: result.alreadyDone,
        });
        return result;
      })
      .catch((err) => {
        gate.state = 'errored';
        setMigrationState('errored');
        log.warn('Address migration failed', {
          message: err instanceof Error ? err.message : 'unknown',
        });
        return null;
      });
  }, [uid, runMigration, callables]);

  // ---- Mutations --------------------------------------------------------
  const addMutation = useMutation<AddAddressResponse, Error, AddAddressInput>({
    mutationFn: (input) => callables.addAddress(input),
    onSuccess: () => {
      // `onSnapshot` will refresh the cache; invalidate so downstream query
      // consumers explicitly re-read if they bypass the snapshot bridge.
      queryClient.invalidateQueries({ queryKey: addressesQueryKey(uid) });
    },
  });

  const updateMutation = useMutation<UpdateAddressResponse, Error, UpdateAddressInput>({
    mutationFn: (input) => callables.updateAddress(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressesQueryKey(uid) });
    },
  });

  const deleteMutation = useMutation<DeleteAddressResponse, Error, DeleteAddressInput>({
    mutationFn: (input) => callables.deleteAddress(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressesQueryKey(uid) });
    },
  });

  const setDefaultMutation = useMutation<SetDefaultAddressResponse, Error, SetDefaultAddressInput>({
    mutationFn: (input) => callables.setDefaultAddress(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressesQueryKey(uid) });
    },
  });

  return useMemo<UseAddressesResult>(
    () => ({
      list: {
        data: addresses,
        isLoading,
        error: snapshotError,
      },
      addresses,
      isLoading,
      error: snapshotError,
      addAddress: addMutation,
      updateAddress: updateMutation,
      deleteAddress: deleteMutation,
      setDefaultAddress: setDefaultMutation,
      migrationState,
    }),
    [
      addresses,
      isLoading,
      snapshotError,
      addMutation,
      updateMutation,
      deleteMutation,
      setDefaultMutation,
      migrationState,
    ],
  );
}

export default useAddresses;
