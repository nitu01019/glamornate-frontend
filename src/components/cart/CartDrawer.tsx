'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { useCartStore } from '@/store/cart';

/** Format duration in minutes to a human-readable string */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs}hr`;
  return `${hrs}hr ${mins}min`;
}

/**
 * Global bottom-sheet cart drawer.
 *
 * Phase 6 (industry-overhaul): previously a prop-driven component mounted only
 * on the home page. The drawer now reads its `isOpen` state from the cart
 * store, so any caller anywhere in the app can open it via
 * `useCartStore.getState().openCart()` without a route change.
 *
 * Mounted globally from `<GlobalWidgets />`.
 */
export default function CartDrawer() {
  const router = useRouter();

  const isOpen = useCartStore((s) => s.isOpen);
  const closeCart = useCartStore((s) => s.closeCart);
  const hasHydrated = useCartStore((s) => s._hasHydrated);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);

  // Close on Escape key.
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, closeCart]);

  // Intercept Android hardware back-button while the cart drawer is open so
  // that pressing back closes the drawer instead of navigating away.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: Event): void => {
      event.preventDefault();
      closeCart();
    };
    window.addEventListener('glamornate:back-button', handler);
    return () => window.removeEventListener('glamornate:back-button', handler);
  }, [isOpen, closeCart]);

  // Hydration guard: avoid SSR/CSR mismatch by rendering nothing until the
  // persisted store has rehydrated from localStorage.
  if (!hasHydrated) return null;
  if (!isOpen) return null;

  const total = getTotal();
  const count = getItemCount();

  const handleViewFullCart = () => {
    closeCart();
    router.push('/cart');
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40 animate-fade-in" onClick={closeCart} />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl animate-slide-up-sheet max-h-[80vh] flex flex-col safe-area-bottom"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Your Cart ({count})</h3>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-500 font-medium">
                Clear All
              </button>
            )}
            <button
              onClick={closeCart}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close cart"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">Your cart is empty</p>
            </div>
          ) : (
            <>
              {items.some((item) => item.price === 0) && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-700 font-medium">
                    One or more services may no longer be available. Review your cart before
                    proceeding.
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.serviceId}
                    className={`flex items-start gap-3 p-3 rounded-xl ${
                      item.price === 0 ? 'bg-red-50' : 'bg-gray-50'
                    }`}
                  >
                    {/* Image */}
                    {item.image && (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                        <Image
                          src={item.image}
                          alt={item.serviceName}
                          width={64}
                          height={64}
                          sizes="64px"
                          className="object-cover rounded-lg"
                        />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {item.serviceName}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDuration(item.duration)}
                      </p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-sm font-bold text-gray-900">&#8377;{item.price}</span>
                        {item.originalPrice != null && item.originalPrice > item.price && (
                          <span className="text-xs text-gray-400 line-through">
                            &#8377;{item.originalPrice}
                          </span>
                        )}
                      </div>
                      {item.price === 0 && (
                        <p className="text-xs text-red-500 mt-0.5 font-medium">
                          This service may no longer be available
                        </p>
                      )}
                    </div>

                    {/* Quantity controls */}
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => removeItem(item.serviceId)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label={`Remove ${item.serviceName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2 bg-brand-maroon-500 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.serviceId, item.quantity - 1)}
                          className="px-2 py-1 text-white hover:bg-brand-maroon-600 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-white text-xs font-semibold min-w-[1rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.serviceId, item.quantity + 1)}
                          className="px-2 py-1 text-white hover:bg-brand-maroon-600 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer with total */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-lg font-bold text-gray-900">
                &#8377;{total.toLocaleString('en-IN')}
              </span>
            </div>
            <button
              type="button"
              onClick={handleViewFullCart}
              className="w-full py-3 btn-cart rounded-xl text-base block text-center"
            >
              View Full Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
