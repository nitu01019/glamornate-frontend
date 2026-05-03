'use client';

/**
 * Single service card rendered in the owner Services grid. Extracted from
 * `spa/services/page.tsx` during Phase 2 Agent-07 (F5 carve).
 */

import {
  Clock,
  DollarSign,
  Droplet,
  Edit,
  Gem,
  Heart,
  Leaf,
  Palette,
  Scissors,
  Sparkle,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ServiceWithId } from '@/hooks/useServices';

const categoryIcons: Record<string, React.ElementType> = {
  facial: Droplet,
  massage: Leaf,
  body: Heart,
  pedicure: Gem,
  manicure: Gem,
  wellness: Sparkle,
  hair: Scissors,
  makeup: Palette,
};

export interface ServiceCardProps {
  service: ServiceWithId;
  onEdit: (service: ServiceWithId) => void;
  onDelete: (serviceId: string) => void;
}

export function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const Icon = categoryIcons[service.category] || Gem;

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{service.name}</h3>
              {service.isActive ? (
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                  Active
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{service.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {service.baseDuration} min
              </span>
              <span className="flex items-center gap-1 font-medium text-amber-600">
                <DollarSign className="w-3 h-3" />
                {service.basePrice}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400 capitalize">
            {service.category.replace('_', ' ')}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => onEdit(service)}
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-500"
              onClick={() => onDelete(service.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
