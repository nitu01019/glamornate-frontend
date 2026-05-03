'use client';

import Image from 'next/image';
import { Clock, Minus, Plus } from 'lucide-react';
import ServiceBadge from '@/components/ui/ServiceBadge';
import type { ServiceItem } from './types';

interface ServiceCardProps {
  service: ServiceItem;
  quantity?: number;
  onAddToCart?: (serviceId: string) => void;
  onUpdateQuantity?: (serviceId: string, quantity: number) => void;
}

export default function ServiceCard({
  service,
  quantity = 0,
  onAddToCart,
  onUpdateQuantity,
}: ServiceCardProps) {
  const topBadge = service.badges[0] ?? null;

  return (
    <div className="flex-shrink-0 w-44 md:w-52 flex flex-col card-service group">
      {/* Image */}
      <div className="relative aspect-[4/3] rounded-t-card-lg overflow-hidden bg-gray-100">
        <Image
          src={service.image}
          alt={service.name}
          fill
          sizes="(max-width: 768px) 176px, 208px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Fallback */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-maroon-100 to-brand-maroon-50 -z-10" />

        {/* Badge */}
        {topBadge && (
          <span className="absolute top-2 left-2 z-10">
            <ServiceBadge badge={topBadge} />
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 mb-1.5">
          {service.name}
        </h3>

        {/* Duration */}
        <div className="flex items-center gap-1 text-muted-foreground mb-2">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs">{service.duration}</span>
        </div>

        {/* Price row */}
        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-base font-bold text-gray-900">
            &#8377;{service.price}
          </span>
          {service.originalPrice > service.price && (
            <>
              <span className="text-xs text-gray-400 line-through">
                &#8377;{service.originalPrice}
              </span>
              <span className="text-xs font-semibold text-brand-green-600">
                {service.discount}% OFF
              </span>
            </>
          )}
        </div>

        {/* Add to Cart / Quantity selector */}
        <div className="mt-auto">
        {quantity > 0 ? (
          <div className="flex items-center justify-between bg-brand-maroon-500 rounded-lg overflow-hidden shadow-maroon animate-scale-in">
            <button
              onClick={() => onUpdateQuantity?.(service.id, quantity - 1)}
              className="px-3 py-2 text-white hover:bg-brand-maroon-600 active:bg-brand-maroon-700 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-white font-bold text-sm tabular-nums">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity?.(service.id, quantity + 1)}
              className="px-3 py-2 text-white hover:bg-brand-maroon-600 active:bg-brand-maroon-700 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAddToCart?.(service.id)}
            className="w-full py-2 border border-brand-maroon-500 text-brand-maroon-500 text-sm font-semibold rounded-lg hover:bg-brand-maroon-50 transition-all duration-200 active:scale-[0.96] active:bg-brand-maroon-100"
          >
            Add To Cart
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
