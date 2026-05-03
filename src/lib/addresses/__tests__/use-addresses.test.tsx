/**
 * Tests for `useAddresses`.
 *
 * Strategy
 * --------
 * - Mock `firebase/firestore` so the `onSnapshot` subscription is driven
 *   deterministically from the tests.
 * - Mock `@/lib/auth-provider` with a mutable auth state.
 * - Pass injected stub callables via `options.callables` to avoid reaching
 *   Firebase Functions entirely.
 *
 * Coverage
 * --------
 * - Reflects Firestore addresses into the React Query cache.
 * - `addAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`
 *   invoke their respective callables with the correct payload.
 * - Migration runs exactly once per uid per session.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  AddAddressInput,
  UpdateAddressInput,
  DeleteAddressInput,
  SetDefaultAddressInput,
  AddressesCallables,
} from '../use-addresses';
import type { SavedAddress } from '@/types';

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------

const authState: { firebaseUser: { uid: string } | null } = {
  firebaseUser: { uid: 'uid-test' },
};

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => authState,
}));

// ---------------------------------------------------------------------------
// Firebase SDK mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase-client', () => ({
  getFirebaseFirestore: vi.fn(() => ({ __db: true })),
  getFirebaseApp: vi.fn(() => ({ __app: true })),
}));

interface SnapshotNext {
  (snap: {
    docs: Array<{ id: string; data: () => Record<string, unknown> }>;
  }): void;
}

let capturedNext: SnapshotNext | null = null;
const unsubscribeSpy = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ __ref: 'collection' })),
  query: vi.fn((ref: unknown) => ref),
  onSnapshot: vi.fn(
    (_ref: unknown, next: SnapshotNext) => {
      capturedNext = next;
      return unsubscribeSpy;
    },
  ),
}));

// Firebase functions never hit in these tests — we inject callables.
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
}));

// Logger mock so we don't spam the test console.
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRawAddress(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    label: 'home',
    name: 'Aanya',
    phone: '+911234567890',
    flatHouse: 'Flat 2B',
    street: 'MG Road',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    isDefault: true,
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }): JSX.Element {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// Import after mocks are registered.
async function loadModule(): Promise<typeof import('../use-addresses')> {
  return import('../use-addresses');
}

async function emitDocs(
  docs: Array<{ id: string; data: Record<string, unknown> }>,
): Promise<void> {
  expect(capturedNext).not.toBeNull();
  await act(async () => {
    capturedNext!({
      docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
    });
  });
}

beforeEach(async () => {
  capturedNext = null;
  unsubscribeSpy.mockReset();
  authState.firebaseUser = { uid: 'uid-test' };
  const mod = await loadModule();
  mod.__resetMigrationGateForTests();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAddresses', () => {
  it('mirrors snapshot docs into addresses list, default first', async () => {
    const { useAddresses } = await loadModule();
    const callables: AddressesCallables = {
      addAddress: vi.fn(),
      updateAddress: vi.fn(),
      deleteAddress: vi.fn(),
      setDefaultAddress: vi.fn(),
      migrateAddressesToSubcollection: vi
        .fn()
        .mockResolvedValue({ migrated: 0, alreadyDone: true }),
    };

    const { result } = renderHook(
      () => useAddresses({ callables, runMigration: false }),
      { wrapper },
    );

    await emitDocs([
      { id: 'addr-work', data: buildRawAddress({ isDefault: false }) },
      { id: 'addr-home', data: buildRawAddress({ isDefault: true }) },
    ]);

    await waitFor(() => {
      expect(result.current.addresses.length).toBe(2);
    });
    const ids = result.current.addresses.map((a) => a.id);
    expect(ids[0]).toBe('addr-home'); // default first
    expect(ids[1]).toBe('addr-work');
  });

  it('invokes addAddress callable with the input payload', async () => {
    const { useAddresses } = await loadModule();
    const addAddress = vi.fn().mockResolvedValue({
      addressId: 'addr-new',
      isDefault: true,
    });

    const callables: AddressesCallables = {
      addAddress,
      updateAddress: vi.fn(),
      deleteAddress: vi.fn(),
      setDefaultAddress: vi.fn(),
      migrateAddressesToSubcollection: vi
        .fn()
        .mockResolvedValue({ migrated: 0, alreadyDone: true }),
    };

    const { result } = renderHook(
      () => useAddresses({ callables, runMigration: false }),
      { wrapper },
    );

    const payload: AddAddressInput = {
      label: 'home',
      name: 'Aanya',
      phone: '1234567890',
      flatHouse: 'Flat 2B',
      street: 'MG Road',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
    };

    await act(async () => {
      await result.current.addAddress.mutateAsync(payload);
    });

    expect(addAddress).toHaveBeenCalledTimes(1);
    expect(addAddress).toHaveBeenCalledWith(payload);
  });

  it('invokes updateAddress callable with patch shape', async () => {
    const { useAddresses } = await loadModule();
    const updateAddress = vi.fn().mockResolvedValue({
      addressId: 'addr-1',
      isDefault: false,
    });

    const { result } = renderHook(
      () =>
        useAddresses({
          callables: {
            addAddress: vi.fn(),
            updateAddress,
            deleteAddress: vi.fn(),
            setDefaultAddress: vi.fn(),
            migrateAddressesToSubcollection: vi
              .fn()
              .mockResolvedValue({ migrated: 0, alreadyDone: true }),
          },
          runMigration: false,
        }),
      { wrapper },
    );

    const payload: UpdateAddressInput = {
      addressId: 'addr-1',
      patch: { city: 'Mumbai' },
    };

    await act(async () => {
      await result.current.updateAddress.mutateAsync(payload);
    });

    expect(updateAddress).toHaveBeenCalledWith(payload);
  });

  it('invokes deleteAddress callable and returns response', async () => {
    const { useAddresses } = await loadModule();
    const deleteAddress = vi.fn().mockResolvedValue({
      deleted: true,
      promotedDefault: null,
    });

    const { result } = renderHook(
      () =>
        useAddresses({
          callables: {
            addAddress: vi.fn(),
            updateAddress: vi.fn(),
            deleteAddress,
            setDefaultAddress: vi.fn(),
            migrateAddressesToSubcollection: vi
              .fn()
              .mockResolvedValue({ migrated: 0, alreadyDone: true }),
          },
          runMigration: false,
        }),
      { wrapper },
    );

    const payload: DeleteAddressInput = { addressId: 'addr-1' };
    let response: { deleted: true; promotedDefault?: string | null } | null =
      null;
    await act(async () => {
      response = await result.current.deleteAddress.mutateAsync(payload);
    });

    expect(deleteAddress).toHaveBeenCalledWith(payload);
    expect(response).toEqual({ deleted: true, promotedDefault: null });
  });

  it('invokes setDefaultAddress callable', async () => {
    const { useAddresses } = await loadModule();
    const setDefaultAddress = vi.fn().mockResolvedValue({ addressId: 'addr-1' });

    const { result } = renderHook(
      () =>
        useAddresses({
          callables: {
            addAddress: vi.fn(),
            updateAddress: vi.fn(),
            deleteAddress: vi.fn(),
            setDefaultAddress,
            migrateAddressesToSubcollection: vi
              .fn()
              .mockResolvedValue({ migrated: 0, alreadyDone: true }),
          },
          runMigration: false,
        }),
      { wrapper },
    );

    const payload: SetDefaultAddressInput = { addressId: 'addr-1' };
    await act(async () => {
      await result.current.setDefaultAddress.mutateAsync(payload);
    });

    expect(setDefaultAddress).toHaveBeenCalledWith(payload);
  });

  it('runs migration exactly once per uid per session', async () => {
    const { useAddresses } = await loadModule();
    const migrateAddressesToSubcollection = vi
      .fn()
      .mockResolvedValue({ migrated: 0, alreadyDone: true });

    const callables: AddressesCallables = {
      addAddress: vi.fn(),
      updateAddress: vi.fn(),
      deleteAddress: vi.fn(),
      setDefaultAddress: vi.fn(),
      migrateAddressesToSubcollection,
    };

    const { rerender, unmount } = renderHook(
      () => useAddresses({ callables }),
      { wrapper },
    );

    // Re-mount — guard must prevent a second invocation.
    rerender();

    await waitFor(() => {
      expect(migrateAddressesToSubcollection).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Mount again (fresh hook) — still guarded.
    renderHook(() => useAddresses({ callables }), { wrapper });
    await waitFor(() => {
      expect(migrateAddressesToSubcollection).toHaveBeenCalledTimes(1);
    });
  });

  it('tolerates migration failure and records errored state', async () => {
    const { useAddresses } = await loadModule();
    const migrate = vi
      .fn()
      .mockRejectedValue(new Error('functions/internal'));

    const { result } = renderHook(
      () =>
        useAddresses({
          callables: {
            addAddress: vi.fn(),
            updateAddress: vi.fn(),
            deleteAddress: vi.fn(),
            setDefaultAddress: vi.fn(),
            migrateAddressesToSubcollection: migrate,
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(migrate).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.migrationState).toBe('errored');
    });
  });

  it('does not subscribe when unauthenticated', async () => {
    authState.firebaseUser = null;
    const { useAddresses } = await loadModule();

    renderHook(() => useAddresses({ runMigration: false }), { wrapper });

    // capturedNext should remain null — no onSnapshot attached.
    expect(capturedNext).toBeNull();
  });

  it('surfaces snapshot-derived addresses as typed SavedAddress objects', async () => {
    const { useAddresses } = await loadModule();
    const { result } = renderHook(
      () =>
        useAddresses({
          callables: {
            addAddress: vi.fn(),
            updateAddress: vi.fn(),
            deleteAddress: vi.fn(),
            setDefaultAddress: vi.fn(),
            migrateAddressesToSubcollection: vi
              .fn()
              .mockResolvedValue({ migrated: 0, alreadyDone: true }),
          },
          runMigration: false,
        }),
      { wrapper },
    );

    await emitDocs([
      {
        id: 'addr-x',
        data: buildRawAddress({ landmark: 'Near Park' }),
      },
    ]);

    await waitFor(() => {
      expect(result.current.addresses.length).toBe(1);
    });
    const addr: SavedAddress = result.current.addresses[0];
    expect(addr.id).toBe('addr-x');
    expect(addr.landmark).toBe('Near Park');
    expect(addr.isDefault).toBe(true);
  });
});
