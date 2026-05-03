'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Clock } from 'lucide-react';
import { formatINR } from '@/lib/utils/currency';

export interface SpaBookingServiceListProps {
  services: Array<{
    name: string;
    duration?: number;
    price?: number;
  }>;
}

export function SpaBookingServiceList({ services }: SpaBookingServiceListProps) {
  if (!services || services.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-maroon-100 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-brand-maroon-600" />
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Services</p>
        </div>
        <ul className="space-y-3">
          {services.map((svc, idx) => (
            <li
              key={`${svc.name}-${idx}`}
              className="flex items-start justify-between gap-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{svc.name}</p>
                {svc.duration !== undefined && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {svc.duration} min
                  </span>
                )}
              </div>
              {svc.price !== undefined && (
                <p className="font-semibold text-gray-900 shrink-0">
                  {formatINR(svc.price)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
