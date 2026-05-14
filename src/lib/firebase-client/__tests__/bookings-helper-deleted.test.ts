/**
 * Regression lock for SC-5 FE half + SC-6 + V-2 (Phase 3, Task 3.4+3.5).
 *
 * The FE direct-write helper at `src/lib/firebase-client/bookings.ts` was
 * deleted (along with the `/api/v1/bookings` Next.js proxy that consumed it)
 * because it produced a divergent doc shape (`{status, bookingNumber, ...}`)
 * that conflicted with the canonical `createBookingDraft` callable shape
 * (`{bookingStatus, slot, pricing, ...}`). Customer booking creation now
 * funnels through a single canonical write path: the `createBookingDraft`
 * Cloud Function, invoked from `useCreateBooking` at
 * `frontend/src/hooks/useBookings.ts:294`.
 *
 * This file locks that delete: any future re-introduction of the helper or
 * its re-exports will fail this suite.
 */
import { describe, it, expect } from 'vitest';

describe('SC-5 FE half / SC-6 / V-2 — booking direct-write helper is gone', () => {
  it('does NOT resolve `@/lib/firebase-client/bookings`', async () => {
    // Indirected via a variable so the TS module resolver does not validate
    // the (now-deleted) path at compile time — the assertion is purely on
    // the runtime resolver's behavior.
    const deletedHelperPath = '@/lib/firebase-client/bookings';
    let resolvedModule: unknown = null;
    let importError: unknown = null;
    try {
      resolvedModule = await import(/* @vite-ignore */ deletedHelperPath);
    } catch (err: unknown) {
      importError = err;
    }
    expect(resolvedModule).toBeNull();
    expect(importError).not.toBeNull();
  });

  it('does NOT re-export the helper symbols from `@/lib/firebase-client`', async () => {
    const mod = (await import('@/lib/firebase-client')) as Record<string, unknown>;
    expect(mod.createBookingRecord).toBeUndefined();
    expect(mod.getUserBookingRecords).toBeUndefined();
    expect(mod.getBookingRecordById).toBeUndefined();
    expect(mod.getBookingsForDate).toBeUndefined();
    expect(mod.updateBookingRecordStatus).toBeUndefined();
  });
});
