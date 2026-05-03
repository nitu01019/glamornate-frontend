import { Clock, Minus, Plus } from 'lucide-react';
import type { SpaServiceWithId } from '@/hooks/useServices';

// Service selection card
export function ServiceCard({
  service,
  selected,
  quantity,
  onToggle,
  onQuantityChange,
}: {
  service: SpaServiceWithId;
  selected: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantityChange: (delta: number) => void;
}) {
  const name = service.customName || service.service?.name || 'Service';
  const price = service.priceOverride ?? service.service?.basePrice ?? 0;
  const duration = service.durationOverride ?? service.service?.baseDuration ?? 60;
  const description = service.service?.description || '';

  return (
    <div
      onClick={onToggle}
      className={`rounded-2xl p-4 cursor-pointer transition-all duration-200 ${
        selected ? 'bg-brand-maroon-50 ring-2 ring-brand-maroon-500' : 'bg-white hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{name}</h3>
          {description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              {duration} min
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {selected ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onQuantityChange(-1)}
                className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50"
              >
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="w-6 text-center font-semibold">{quantity}</span>
              <button
                onClick={() => onQuantityChange(1)}
                className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-lg font-bold text-brand-maroon-500">
              <span>₹{price.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
      {selected && (
        <div className="mt-3 pt-3 border-t border-brand-maroon-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">Subtotal</span>
          <span className="font-semibold text-brand-maroon-500">
            ₹{(price * quantity).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
