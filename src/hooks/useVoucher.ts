'use client';

/**
 * Voucher Hooks - React Query hooks for voucher validation, redemption, and listing
 * Wires the backend validateVoucher / redeemVoucher Cloud Functions into the cart store
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  firebaseClientWrapper,
  QueryConstraintConfig,
} from '@/lib/firebase-client-wrapper';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/lib/auth-provider';
import { isFirebaseConfigured } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import type { Voucher, DiscountType } from '@/types';

const voucherLogger = logger.child({ component: 'useVoucher' });

// =============================================================================
// Types
// =============================================================================

interface ValidateVoucherRequest extends Record<string, unknown> {
  code: string;
  bookingData: {
    spaId: string;
    serviceIds: string[];
    totalAmount: number;
  };
}

interface ValidateVoucherResponse {
  success: boolean;
  valid: boolean;
  discountAmount: number;
  voucher?: {
    code: string;
    discountType: DiscountType;
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderAmount?: number;
  };
  error?: string;
}

interface RedeemVoucherRequest extends Record<string, unknown> {
  code: string;
  bookingId: string;
}

interface RedeemVoucherResponse {
  success: boolean;
  discountAmount: number;
  newTotal: number;
  remainingUses: number;
  voucherName: string;
}

interface ApplyVoucherResult {
  success: boolean;
  discountAmount?: number;
  error?: string;
}

export interface VoucherWithId extends Voucher {
  id: string;
}

// =============================================================================
// Query Keys
// =============================================================================

export const voucherQueryKeys = {
  all: ['vouchers'] as const,
  available: () => [...voucherQueryKeys.all, 'available'] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Validate and apply a voucher code to the current cart
 *
 * Calls the `validateVoucher` Cloud Function with the current cart state,
 * and on success stores the validated voucher data in the cart store.
 *
 * @returns Mutation returning `{ success, discountAmount?, error? }`
 *
 * @example
 * ```tsx
 * const { mutateAsync: applyVoucher, isPending } = useApplyVoucher();
 * const result = await applyVoucher('FLAT200');
 * if (result.success) { ... }
 * ```
 */
export function useApplyVoucher() {
  const hooksLogger = voucherLogger;

  return useMutation<ApplyVoucherResult, Error, string>({
    mutationFn: async (code: string): Promise<ApplyVoucherResult> => {
      const { items, getTotal } = useCartStore.getState();

      if (items.length === 0) {
        return { success: false, error: 'Cart is empty' };
      }

      hooksLogger.info('Validating voucher', { code });

      const result = await firebaseClientWrapper.callFunction<
        ValidateVoucherRequest,
        ValidateVoucherResponse
      >('validateVoucher', {
        code,
        bookingData: {
          spaId: 'glamornate-default',
          serviceIds: items.map((i) => i.serviceId),
          totalAmount: getTotal(),
        },
      });

      if (!result.valid) {
        hooksLogger.warn('Voucher validation failed', { code, error: result.error });
        return { success: false, error: result.error ?? 'Invalid voucher' };
      }

      useCartStore.getState().applyVoucher({
        code,
        discount: result.discountAmount,
        discountType: result.voucher?.discountType ?? 'flat',
        discountValue: result.voucher?.discountValue ?? result.discountAmount,
        maxDiscount: result.voucher?.maxDiscountAmount,
        minOrder: result.voucher?.minOrderAmount,
        name: result.voucher?.code ?? code,
      });

      hooksLogger.info('Voucher applied successfully', {
        code,
        discountAmount: result.discountAmount,
      });

      return { success: true, discountAmount: result.discountAmount };
    },
  });
}

/**
 * Redeem a voucher after booking draft creation
 *
 * Calls the `redeemVoucher` Cloud Function to lock the voucher against a
 * specific booking. Should be called after `createBookingDraft` succeeds.
 *
 * @returns Mutation accepting `{ code, bookingId }`
 *
 * @example
 * ```tsx
 * const { mutateAsync: redeemVoucher } = useRedeemVoucher();
 * await redeemVoucher({ code: 'FLAT200', bookingId: 'booking-123' });
 * ```
 */
export function useRedeemVoucher() {
  const hooksLogger = voucherLogger;

  return useMutation<RedeemVoucherResponse, Error, { code: string; bookingId: string }>({
    mutationFn: async ({ code, bookingId }) => {
      hooksLogger.info('Redeeming voucher', { code, bookingId });

      const result = await firebaseClientWrapper.callFunction<
        RedeemVoucherRequest,
        RedeemVoucherResponse
      >('redeemVoucher', { code, bookingId });

      hooksLogger.info('Voucher redeemed', {
        code,
        bookingId,
        remainingUses: result.remainingUses,
      });

      return result;
    },
  });
}

/**
 * Fetch available vouchers from Firestore
 *
 * Queries the `vouchers` collection for active vouchers, then filters out
 * any that have expired client-side. Only enabled when the user is
 * authenticated and Firebase is configured.
 *
 * @returns Query result with `VoucherWithId[]`
 *
 * @example
 * ```tsx
 * const { data: vouchers } = useAvailableVouchers();
 * ```
 */
export function useAvailableVouchers() {
  const { firebaseUser } = useAuth();
  const hooksLogger = voucherLogger;

  return useQuery({
    queryKey: voucherQueryKeys.available(),
    enabled: !!firebaseUser && isFirebaseConfigured(),
    queryFn: async (): Promise<VoucherWithId[]> => {
      try {
        const constraints: QueryConstraintConfig[] = [
          {
            type: 'where',
            field: 'isActive',
            operator: '==',
            value: true,
          },
        ];

        const result = await firebaseClientWrapper.getDocuments<Voucher>(
          'vouchers',
          constraints,
        );

        const now = new Date().toISOString();

        const activeVouchers = result.documents
          .map((doc) => ({
            id: doc.id,
            ...doc.data,
          }))
          .filter((voucher) => voucher.validUntil >= now);

        hooksLogger.debug('Fetched available vouchers', {
          total: result.documents.length,
          active: activeVouchers.length,
        });

        return activeVouchers;
      } catch (error) {
        hooksLogger.error('Failed to fetch vouchers', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
