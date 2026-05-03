import Image from 'next/image';
import { Check, MapPin, Star } from 'lucide-react';
import type { SpaWithId } from '@/hooks/useSpas';

// Spa selection card
export function SpaCard({
  spa,
  selected,
  onSelect,
}: {
  spa: SpaWithId;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-2xl overflow-hidden transition-all duration-200 ${
        selected ? 'ring-2 ring-brand-maroon-500 bg-brand-maroon-50' : 'bg-white hover:shadow-lg'
      }`}
    >
      <div className="flex gap-4 p-4">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
          <Image
            src={
              spa.featuredImage ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                spa.name,
              )}&background=f43f5e&color=fff`
            }
            alt={spa.name}
            fill
            className="object-cover"
            sizes="80px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{spa.name}</h3>
              {spa.tier === 'premium' && (
                <span className="inline-block px-2 py-0.5 bg-brand-gold-100 text-brand-gold-700 text-xs font-medium rounded-full mt-1">
                  PREMIUM
                </span>
              )}
            </div>
            {selected && (
              <div className="w-6 h-6 bg-brand-maroon-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{spa.location?.city}</span>
          </div>
          <div className="flex items-center gap-1 text-sm mt-1">
            <Star className="w-3.5 h-3.5 text-brand-gold-400 fill-brand-gold-400" />
            <span className="font-medium text-gray-900">
              {spa.rating?.overall?.toFixed(1) || 'N/A'}
            </span>
            <span className="text-gray-400">({spa.rating?.count || 0})</span>
          </div>
        </div>
      </div>
    </button>
  );
}
