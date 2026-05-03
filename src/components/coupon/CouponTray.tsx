'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Ticket, Loader2, Check, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import {
  useApplyVoucher,
  useAvailableVouchers,
  type VoucherWithId,
} from '@/hooks/useVoucher';
import type { Voucher } from '@/types';

interface CouponTrayProps {
  isOpen: boolean;
  onClose: () => void;
}

function getDiscountLabel(voucher: Voucher): string {
  if (voucher.discountType === 'percentage') {
    return `${voucher.discountValue}% off`;
  }
  if (voucher.discountType === 'flat') {
    return `Flat \u20B9${voucher.discountValue.toLocaleString('en-IN')} off`;
  }
  return `\u20B9${voucher.discountValue.toLocaleString('en-IN')}`;
}

function getBadgeColor(voucher: Voucher): string {
  if (voucher.discountType === 'percentage') {
    return 'bg-brand-green-100 text-brand-green-700';
  }
  return 'bg-brand-gold-100 text-brand-gold-800';
}

function getBorderColor(voucher: Voucher): string {
  if (voucher.discountType === 'percentage') {
    return 'border-l-brand-green-500';
  }
  return 'border-l-brand-gold-500';
}

export default function CouponTray({ isOpen, onClose }: CouponTrayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentVoucherCode = useCartStore((s) => s.voucherCode);

  const { data: vouchers, isLoading } = useAvailableVouchers();
  const { mutateAsync: applyVoucher } = useApplyVoucher();

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const handleApply = useCallback(
    async (voucher: VoucherWithId) => {
      setApplyingCode(voucher.code);
      try {
        const result = await applyVoucher(voucher.code);
        if (result.success) {
          onClose();
        }
      } catch {
        // Error handling is done by the mutation hook
      } finally {
        setApplyingCode(null);
      }
    },
    [applyVoucher, onClose],
  );

  if (!isOpen) {
    return null;
  }

  const voucherList = vouchers ?? [];

  return (
    <div role="dialog" aria-modal="true" aria-label="Available coupons">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-2xl bg-white shadow-card-lg transition-transform duration-300 ease-out',
          isVisible ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight: '75vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-brand-maroon-500" />
            <h2 className="text-lg font-bold text-gray-900">
              Available Coupons
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close coupon tray"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div
          className="overflow-y-auto px-5 py-4"
          style={{ maxHeight: 'calc(75vh - 64px)' }}
        >
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-maroon-400" />
              <p className="mt-3 text-sm text-gray-500">
                Loading coupons...
              </p>
            </div>
          )}

          {!isLoading && voucherList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Ticket className="h-8 w-8 text-gray-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-gray-600">
                No coupons available
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Check back later for new offers
              </p>
            </div>
          )}

          {!isLoading && voucherList.length > 0 && (
            <div className="space-y-3">
              {voucherList.map((voucher) => {
                const isCurrentlyApplied =
                  currentVoucherCode === voucher.code;
                const isApplyingThis = applyingCode === voucher.code;

                return (
                  <VoucherCard
                    key={voucher.code}
                    voucher={voucher}
                    isApplied={isCurrentlyApplied}
                    isApplying={isApplyingThis}
                    onApply={handleApply}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom safe area */}
        <div className="h-6" />
      </div>
    </div>
  );
}

interface VoucherCardProps {
  voucher: VoucherWithId;
  isApplied: boolean;
  isApplying: boolean;
  onApply: (voucher: VoucherWithId) => void;
}

function VoucherCard({
  voucher,
  isApplied,
  isApplying,
  onApply,
}: VoucherCardProps) {
  const handleApply = useCallback(() => {
    if (!isApplied && !isApplying) {
      onApply(voucher);
    }
  }, [voucher, isApplied, isApplying, onApply]);

  const discountLabel = getDiscountLabel(voucher);
  const badgeColor = getBadgeColor(voucher);
  const borderColor = getBorderColor(voucher);

  const conditions: string[] = [];
  if (voucher.minOrderAmount > 0) {
    conditions.push(
      `Min order \u20B9${voucher.minOrderAmount.toLocaleString('en-IN')}`,
    );
  }
  if (
    voucher.maxDiscountAmount !== undefined &&
    voucher.maxDiscountAmount !== null &&
    voucher.maxDiscountAmount > 0
  ) {
    conditions.push(
      `Max discount \u20B9${voucher.maxDiscountAmount.toLocaleString('en-IN')}`,
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-card-sm transition-shadow hover:shadow-card-md',
        'border-l-4',
        borderColor,
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          {/* Discount badge */}
          <span
            className={cn(
              'inline-block rounded-md px-2 py-0.5 text-xs font-bold',
              badgeColor,
            )}
          >
            {discountLabel}
          </span>

          {/* Code */}
          <p className="mt-2 font-mono text-sm font-bold tracking-wider text-gray-900">
            {voucher.code}
          </p>

          {/* Description */}
          <p className="mt-1 text-xs text-gray-600">
            {voucher.discountType === 'percentage'
              ? `Get ${voucher.discountValue}% off on your order`
              : `Flat \u20B9${voucher.discountValue.toLocaleString('en-IN')} off on your order`}
          </p>

          {/* Conditions */}
          {conditions.length > 0 && (
            <p className="mt-1.5 text-xs text-gray-400">
              {conditions.join(' \u00B7 ')}
            </p>
          )}
        </div>

        {/* Apply / Applied button */}
        <div className="shrink-0 pt-1">
          {isApplied ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-brand-green-100 px-3 py-1.5 text-xs font-bold text-brand-green-700">
              <Check className="h-3.5 w-3.5" />
              Applied
            </span>
          ) : (
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="rounded-lg bg-brand-maroon-500 px-4 py-1.5 text-xs font-bold text-white transition-all hover:bg-brand-maroon-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Apply'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
