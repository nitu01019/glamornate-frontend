'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import CartItemRow from '@/components/cart/CartItemRow';
import CartSummary from '@/components/cart/CartSummary';
import { NoOrders } from '@/components/ui/EmptyState';

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const hasHydrated = useCartStore((state) => state._hasHydrated);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleClearCart = () => {
    setShowClearConfirm(true);
  };

  const handleValidateAndProceed = async (destination: string) => {
    setCheckoutError(null);
    setIsValidating(true);
    try {
      const payload = items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity }));
      // apiClient unwraps the envelope and throws ApiError on failure, so a
      // successful resolution means validation passed.
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.post('/cart/validate', { items: payload });
      router.push(destination);
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      setCheckoutError(message ?? 'Unable to proceed to checkout. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  // Show nothing until the persisted store has rehydrated from localStorage
  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-brand-maroon-500" />
      </div>
    );
  }

  const isEmpty = items.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-white animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length <= 2) {
                  router.push('/');
                } else {
                  router.back();
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Your Cart</h1>
          </div>
          {!isEmpty && (
            <button
              onClick={handleClearCart}
              className="text-sm font-medium text-brand-maroon-500 transition-colors hover:text-brand-maroon-600 active:scale-95"
            >
              Clear Cart
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <NoOrders
            action={{
              label: 'Browse Services',
              href: '/services',
            }}
          />
        </div>
      ) : (
        <>
          <div className="flex-1 divide-y divide-gray-50">
            {items.map((item) => (
              <CartItemRow key={item.serviceId} item={item} />
            ))}
            {/* Spacer so the last item never sits under the fixed CTA bar. */}
            <div aria-hidden="true" className="h-28" />
          </div>

          {/* Fixed CTA bar — sits ABOVE the bottom nav (h-16) AND the iOS
              home-indicator inset. Red-team T-B1 flagged that the prior
              `bottom-16` (= 4 rem = 64 px) ignored the safe-area inset on
              its `bottom` axis, so on iPhone 14/15 with a ~34 px home
              indicator the CTA bar overlapped the nav by ~2 px. Inline
              style applies `calc(4rem + env(safe-area-inset-bottom))` so
              the bar always clears both. z-30 keeps the bottom nav (z-50)
              on top for its own badge stacking. */}
          <div
            style={{ bottom: `calc(4rem + env(safe-area-inset-bottom, 0px))` }}
            className="fixed left-0 right-0 z-30 border-t border-gray-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
          >
            {checkoutError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 mx-4">
                <p className="text-sm text-red-700 font-medium">{checkoutError}</p>
              </div>
            )}
            <CartSummary onProceed={handleValidateAndProceed} isValidating={isValidating} />
          </div>
        </>
      )}

      {showClearConfirm && (
        <ClearCartConfirm
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={() => {
            clearCart();
            setShowClearConfirm(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClearCartConfirm — accessible confirmation dialog (red-team T-B1 finding).
// The previous raw <div> overlay had no role="dialog", no aria-modal, no
// focus trap, no Escape handler. We use Radix DialogPrimitive (already a
// dependency) to get all of those for free.
// ---------------------------------------------------------------------------

function ClearCartConfirm({
  onCancel,
  onConfirm,
}: {
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  return (
    <DialogPrimitive.Root open={true} onOpenChange={(next) => (next ? null : onCancel())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="text-lg font-bold text-gray-900 mb-2">
            Clear Cart?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-gray-500 mb-6">
            This will remove all items from your cart.
          </DialogPrimitive.Description>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 min-h-[44px] px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-300"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Clear Cart
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
