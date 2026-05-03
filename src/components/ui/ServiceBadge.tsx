import type { ServiceBadge as ServiceBadgeType } from '@/lib/badge-engine';

// ---------------------------------------------------------------------------
// Color mapping (Tailwind class strings per badge type)
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<ServiceBadgeType['type'], string> = {
  'most-booked': 'bg-brand-maroon-500 text-white',
  bestseller: 'bg-brand-gold-500 text-brand-maroon-900',
  'top-rated': 'bg-emerald-500 text-white',
  trending: 'bg-orange-500 text-white',
  new: 'bg-sky-500 text-white',
  discount: 'bg-green-600 text-white',
  featured:
    'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ServiceBadgeProps {
  badge: ServiceBadgeType;
}

export default function ServiceBadge({ badge }: ServiceBadgeProps) {
  const colorClasses = COLOR_MAP[badge.type] ?? 'bg-gray-500 text-white';

  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${colorClasses}`}
    >
      {badge.label}
    </span>
  );
}
