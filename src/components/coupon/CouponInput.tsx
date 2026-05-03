'use client';

import { useState, useCallback, useEffect } from 'react';
import { Ticket, Loader2, Check, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useApplyVoucher } from '@/hooks/useVoucher';
import CouponTray from './CouponTray';

interface CouponInputProps {
  className?: string;
}

export default function CouponInput({ className }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const storeVoucherCode = useCartStore((s) => s.voucherCode);
  const storeVoucherDiscount = useCartStore((s) => s.voucherDiscount);
  const storeVoucherName = useCartStore((s) => s.voucherName);

  const voucherCode = hasMounted ? storeVoucherCode : null;
  const voucherDiscount = hasMounted ? storeVoucherDiscount : 0;
  const voucherName = hasMounted ? storeVoucherName : null;

  const isApplied = voucherCode !== null && voucherDiscount > 0;

  const { mutateAsync: applyVoucher, isPending } = useApplyVoucher();

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCode(e.target.value.toUpperCase());
      if (error) {
        setError(null);
      }
    },
    [error],
  );

  const handleApply = useCallback(async () => {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setError('Please enter a coupon code');
      return;
    }

    setError(null);

    try {
      const result = await applyVoucher(trimmed);
      if (!result.success) {
        setError(result.error ?? 'Invalid coupon code');
      } else {
        setCode('');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
  }, [code, applyVoucher]);

  const handleRemove = useCallback(() => {
    useCartStore.getState().removeVoucher();
    setCode('');
    setError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleApply();
      }
    },
    [handleApply],
  );

  const handleOpenTray = useCallback(() => {
    setIsTrayOpen(true);
  }, []);

  const handleCloseTray = useCallback(() => {
    setIsTrayOpen(false);
  }, []);

  if (isApplied) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between rounded-xl bg-brand-green-50 px-4 py-3 border border-brand-green-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-green-500">
              <Check className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-green-700">
                {voucherName}
              </p>
              <p className="text-xs text-brand-green-600">
                You save {'\u20B9'}
                {voucherDiscount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Remove applied coupon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CouponTray isOpen={isTrayOpen} onClose={handleCloseTray} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="rounded-xl border-2 border-dashed border-brand-maroon-300 bg-brand-maroon-50 px-3 py-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 shrink-0 text-brand-maroon-400" />
          <input
            type="text"
            value={code}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter coupon code"
            disabled={isPending}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-900 placeholder:text-gray-400 outline-none disabled:opacity-50"
            aria-label="Coupon code"
          />
          <button
            onClick={handleApply}
            disabled={isPending || code.trim().length === 0}
            className="shrink-0 rounded-lg bg-brand-maroon-500 px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-brand-maroon-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Apply'
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="px-1 text-xs font-medium text-red-500" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={handleOpenTray}
        className="flex w-full items-center justify-between px-1 py-1 text-sm font-medium text-brand-maroon-500 transition-colors hover:text-brand-maroon-600"
      >
        <span>Browse coupons</span>
        <ChevronRight className="h-4 w-4" />
      </button>

      <CouponTray isOpen={isTrayOpen} onClose={handleCloseTray} />
    </div>
  );
}
