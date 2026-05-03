'use client';

import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { useCartStore } from '@/store/cart';

interface ViewCartButtonProps {
  onOpen: () => void;
}

export default function ViewCartButton({ onOpen }: ViewCartButtonProps) {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  const storeCount = useCartStore((s) => s.getItemCount());
  const itemCount = hasMounted ? storeCount : 0;

  if (itemCount === 0) return null;

  return (
    <button
      onClick={onOpen}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 btn-cart flex items-center gap-2 px-6 py-3"
    >
      <span className="text-sm font-semibold">
        View Cart &middot; {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
      </span>
      <ChevronUp className="w-4 h-4" />
    </button>
  );
}
