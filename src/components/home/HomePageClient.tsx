'use client';

import { useCallback, useMemo } from 'react';
import { useCartStore } from '@/store/cart';
import { useMostBooked } from '@/hooks/useHomeData';
import { useHasMounted } from '@/hooks/useHasMounted';
import MostBookedSection from './MostBookedSection';
import ViewCartButton from './ViewCartButton';

/**
 * Client-side wrapper that provides cart state to
 * MostBookedSection + ViewCartButton.
 *
 * Phase 6: CartDrawer is no longer mounted here — it lives globally in
 * `<GlobalWidgets />`, and its visibility is driven by `useCartStore.isOpen`.
 */
export default function HomePageClient() {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const storeItems = useCartStore((s) => s.items);

  // Defer cart items to client-only to prevent SSR hydration mismatch.
  const hasMounted = useHasMounted();

  // Fetch all most-booked to have the data available for cart
  const { data: mostBookedResult } = useMostBooked();
  const allServices = mostBookedResult?.services;

  // Build a lookup map: serviceId -> quantity.
  // `items` is derived inside the memo so the dep array stays honest:
  // we only depend on `hasMounted` + the underlying `storeItems`, and the
  // derivation from those is referentially-correct for React to track.
  const cartItems = useMemo(() => {
    const items = hasMounted ? storeItems : [];
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.serviceId] = item.quantity;
    }
    return map;
  }, [hasMounted, storeItems]);

  const handleAddToCart = useCallback(
    (serviceId: string) => {
      const found = allServices?.find((s) => s.id === serviceId);
      if (found) {
        addItem({
          serviceId: found.id,
          serviceName: found.name,
          categoryName: found.category,
          subcategory: found.subcategory ?? '',
          price: found.basePrice,
          originalPrice: found.originalPrice ?? found.basePrice,
          discount: found.discountPercent ?? 0,
          duration: found.durationMinutes,
          image: found.image,
        });
      }
    },
    [addItem, allServices],
  );

  const handleUpdateQuantity = useCallback(
    (serviceId: string, quantity: number) => {
      updateQuantity(serviceId, quantity);
    },
    [updateQuantity],
  );

  return (
    <>
      <MostBookedSection
        onAddToCart={handleAddToCart}
        onUpdateQuantity={handleUpdateQuantity}
        cartItems={cartItems}
      />

      <ViewCartButton onOpen={openCart} />
    </>
  );
}
