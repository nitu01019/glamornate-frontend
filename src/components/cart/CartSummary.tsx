'use client';

import { useState, useEffect } from 'react';
import { Clock, ShoppingBag, Ticket } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/lib/auth-provider';
import CouponInput from '@/components/coupon/CouponInput';

interface CartSummaryProps {
  onProceed?: (destination: string) => void;
  isValidating?: boolean;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}min`;
  if (mins === 0) return `${hrs}hr`;
  return `${hrs}hr ${mins}min`;
}

export default function CartSummary({ onProceed, isValidating = false }: CartSummaryProps) {
  const storeItemCount = useCartStore((state) => state.getItemCount());
  const storeTotal = useCartStore((state) => state.getTotal());
  const storeDuration = useCartStore((state) => state.getTotalDuration());
  const storeVoucherName = useCartStore((state) => state.voucherName);
  const storeVoucherDiscount = useCartStore((state) => state.voucherDiscount);
  const storeDiscountedTotal = useCartStore((state) => state.getDiscountedTotal());
  const { isAuthenticated } = useAuth();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const itemCount = hasMounted ? storeItemCount : 0;
  const total = hasMounted ? storeTotal : 0;
  const totalDuration = hasMounted ? storeDuration : 0;
  const voucherName = hasMounted ? storeVoucherName : null;
  const voucherDiscount = hasMounted ? storeVoucherDiscount : 0;
  const discountedTotal = hasMounted ? storeDiscountedTotal : 0;

  const hasDiscount = voucherName != null && voucherDiscount > 0;
  const formattedSubtotal = `\u20B9${total.toLocaleString('en-IN')}`;
  const formattedDiscount = `\u20B9${voucherDiscount.toLocaleString('en-IN')}`;
  const formattedTotal = `\u20B9${(hasDiscount ? discountedTotal : total).toLocaleString('en-IN')}`;
  const durationText = formatDuration(totalDuration);

  const buttonDestination = hasMounted && isAuthenticated ? '/booking' : '/auth/login';
  const buttonText = hasMounted && isAuthenticated ? 'Proceed to Book' : 'Login to Book';

  return (
    <div className="border-t border-gray-200 bg-white px-4 pb-6 pt-4">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <ShoppingBag className="h-4 w-4" />
          <span>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          <span>Est. {durationText}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Subtotal</span>
        <span
          className={
            hasDiscount ? 'text-sm text-gray-400 line-through' : 'text-xl font-bold text-gray-900'
          }
        >
          {formattedSubtotal}
        </span>
      </div>

      {hasDiscount && (
        <>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm font-medium text-brand-green-600">
              <Ticket className="h-3.5 w-3.5" />
              Coupon: {voucherName}
            </span>
            <span className="text-sm font-medium text-brand-green-600">
              &minus;\u20B9{formattedDiscount.slice(1)}
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-gray-900">{formattedTotal}</span>
          </div>

          <div className="mt-1.5">
            <span className="inline-block rounded-full bg-brand-green-50 px-2 py-0.5 text-xs font-medium text-brand-green-700">
              You save \u20B9{voucherDiscount.toLocaleString('en-IN')}
            </span>
          </div>
        </>
      )}

      <div className="mt-3">
        <CouponInput />
      </div>

      <button
        onClick={() =>
          onProceed ? onProceed(buttonDestination) : (window.location.href = buttonDestination)
        }
        disabled={isValidating}
        className="mt-4 block w-full rounded-xl bg-brand-maroon-500 py-3.5 text-center text-base font-semibold text-white transition-all hover:bg-brand-maroon-600 active:scale-[0.98] shadow-maroon disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isValidating ? 'Checking...' : buttonText}
      </button>
    </div>
  );
}
