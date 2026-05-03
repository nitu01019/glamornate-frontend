'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
          </div>

          {/* Sticky summary at bottom */}
          <div className="sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Clear Cart?</h3>
            <p className="text-sm text-gray-500 mb-6">This will remove all items from your cart.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearCart();
                  setShowClearConfirm(false);
                }}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
