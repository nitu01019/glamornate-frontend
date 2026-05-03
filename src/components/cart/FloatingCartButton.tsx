'use client';

import { useEffect, useRef, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/cart';

export default function FloatingCartButton() {
  // Phase 6: clicking the floating cart button now opens the global cart
  // drawer instead of navigating to `/cart`. This avoids a full route change
  // and keeps the user in context of whatever page they were on.
  const openCart = useCartStore((state) => state.openCart);
  const storeItemCount = useCartStore((state) => state.getItemCount());
  const [shouldBounce, setShouldBounce] = useState(false);
  const previousCountRef = useRef(0);

  // Defer to client-only — cart store reads from localStorage which doesn't
  // exist on the server. Without this, server renders null (0 items) but
  // client renders the button (has items) → hydration mismatch.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const itemCount = hasMounted ? storeItemCount : 0;

  useEffect(() => {
    if (itemCount !== previousCountRef.current && itemCount > 0) {
      setShouldBounce(true);
      const timer = setTimeout(() => {
        setShouldBounce(false);
      }, 1000);
      previousCountRef.current = itemCount;
      return () => clearTimeout(timer);
    }
    previousCountRef.current = itemCount;
  }, [itemCount]);

  if (itemCount === 0) {
    return null;
  }

  return (
    <button
      onClick={openCart}
      className={`fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green-600 text-white shadow-float-btn transition-all hover:bg-brand-green-700 active:scale-95 ${
        shouldBounce ? 'animate-bounce' : ''
      }`}
      aria-label={`View cart with ${itemCount} item${itemCount === 1 ? '' : 's'}`}
    >
      <ShoppingBag className="h-6 w-6" />
      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-maroon-500 text-xs font-bold text-white">
        {itemCount > 99 ? '99+' : itemCount}
      </span>
    </button>
  );
}
