'use client';

import { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import type { HomeService } from '@/lib/mock-data';
import type { CartItem } from '@/types';

interface ServiceListProps {
  services: HomeService[];
  categorySlug: string;
}

function ServiceRow({ service }: { service: HomeService }) {
  const storeItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const items = hasMounted ? storeItems : [];

  const cartItem = items.find((i) => i.serviceId === service.id);
  const quantity = cartItem?.quantity ?? 0;

  const handleAdd = () => {
    const newItem: Omit<CartItem, 'quantity'> = {
      serviceId: service.id,
      serviceName: service.name,
      categoryName: service.category,
      subcategory: service.subcategory ?? '',
      price: service.basePrice,
      duration: service.durationMinutes,
      image: service.image,
    };
    addItem(newItem);
  };

  const handleIncrement = () => {
    updateQuantity(service.id, quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity <= 1) {
      removeItem(service.id);
    } else {
      updateQuantity(service.id, quantity - 1);
    }
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm font-medium text-gray-900 truncate">{service.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{service.duration}</p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <p className="text-sm font-semibold text-gray-900 w-16 text-right">
          {service.basePrice.toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
          })}
        </p>

        {quantity === 0 ? (
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Add +
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-1">
            <button
              onClick={handleDecrement}
              className="w-7 h-7 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 rounded transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-emerald-700 w-5 text-center">
              {quantity}
            </span>
            <button
              onClick={handleIncrement}
              className="w-7 h-7 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ServiceList({
  services,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `categorySlug` is part of the public prop contract (consumed by analytics sibling); destructuring here documents the API shape even though this component does not read it
  categorySlug,
}: ServiceListProps) {
  if (services.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">No services found.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {services.map((service) => (
        <ServiceRow key={service.id} service={service} />
      ))}
    </div>
  );
}
