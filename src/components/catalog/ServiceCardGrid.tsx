'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Clock, Minus, Plus } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import type { HomeService } from '@/lib/mock-data';
import type { CartItem } from '@/types';

interface ServiceCardGridProps {
  services: HomeService[];
  categorySlug: string;
}

function FacialServiceCard({ service }: { service: HomeService & { isLandscapeImage?: boolean } }) {
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

  const handleIncrement = () => updateQuantity(service.id, quantity + 1);
  const handleDecrement = () => {
    if (quantity <= 1) {
      removeItem(service.id);
    } else {
      updateQuantity(service.id, quantity - 1);
    }
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-card-sm border border-gray-100">
      {/* Image area */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-100 rounded-t-2xl">
        <Image
          src={service.image}
          alt={service.name}
          fill
          className="object-cover object-center"
          sizes="(max-width: 640px) 50vw, 33vw"
        />

        {/* Landscape "Most Booked" curtain animation */}
        {service.isLandscapeImage && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-brand-maroon-500 animate-curtain flex flex-col items-center justify-center gap-1">
              <span className="text-white text-sm font-bold animate-text-most">Most</span>
              <span className="text-white text-lg font-extrabold animate-text-booked">Booked</span>
            </div>
          </div>
        )}

        {/* ADD / Quantity controls */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          {quantity === 0 ? (
            <button
              onClick={handleAdd}
              className="px-5 py-1.5 bg-white rounded-lg shadow-md text-brand-maroon-600 text-sm font-bold border border-brand-maroon-100 active:scale-95 transition-transform"
            >
              ADD
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-brand-maroon-500 rounded-lg px-1 shadow-md">
              <button
                onClick={handleDecrement}
                aria-label="Decrease quantity"
                className="w-9 h-9 flex items-center justify-center text-white"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold text-white w-5 text-center">{quantity}</span>
              <button
                onClick={handleIncrement}
                aria-label="Increase quantity"
                className="w-9 h-9 flex items-center justify-center text-white"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Text area */}
      <div className="px-2.5 pt-2 pb-3">
        <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2rem]">
          {service.name}
        </h3>
        <div className="flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="text-[11px] text-gray-500">{service.duration}</span>
        </div>
        <p className="text-sm font-bold text-gray-900 mt-1">
          {service.basePrice.toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
          })}
        </p>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `categorySlug` is part of the public prop contract used by analytics sibling; retained in signature to document the API shape
export default function ServiceCardGrid({ services, categorySlug }: ServiceCardGridProps) {
  if (services.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">No services found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {services.map((service) => (
        <FacialServiceCard key={service.id} service={service} />
      ))}
    </div>
  );
}
