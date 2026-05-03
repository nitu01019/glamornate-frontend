'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import type { CartItem } from '@/types';

interface CartItemRowProps {
  item: CartItem;
}

export default function CartItemRow({ item }: CartItemRowProps) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const formattedPrice = `\u20B9${(item.price * item.quantity).toLocaleString('en-IN')}`;
  const unitPrice = `\u20B9${item.price.toLocaleString('en-IN')}`;

  const handleDecrement = () => {
    if (item.quantity === 1) {
      removeItem(item.serviceId);
    } else {
      updateQuantity(item.serviceId, item.quantity - 1);
    }
  };

  const handleIncrement = () => {
    updateQuantity(item.serviceId, item.quantity + 1);
  };

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold text-gray-900">
            {item.serviceName}
          </h3>
          {item.subcategory && (
            <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {item.subcategory}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-4">
          <span className="text-base font-semibold text-gray-900">
            {formattedPrice}
          </span>
          {item.quantity > 1 && (
            <span className="text-xs text-gray-500">
              {unitPrice} each
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center rounded-lg border border-gray-200">
          <button
            onClick={handleDecrement}
            className="flex h-8 w-8 items-center justify-center rounded-l-lg text-gray-600 transition-colors hover:bg-gray-100"
            aria-label={
              item.quantity === 1
                ? `Remove ${item.serviceName} from cart`
                : `Decrease quantity of ${item.serviceName}`
            }
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="flex h-8 w-8 items-center justify-center text-sm font-medium text-gray-900">
            {item.quantity}
          </span>
          <button
            onClick={handleIncrement}
            className="flex h-8 w-8 items-center justify-center rounded-r-lg text-gray-600 transition-colors hover:bg-gray-100"
            aria-label={`Increase quantity of ${item.serviceName}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => removeItem(item.serviceId)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          aria-label={`Remove ${item.serviceName} from cart`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
