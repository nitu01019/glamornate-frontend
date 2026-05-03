'use client';

/**
 * Services grid wrapper — handles loading / empty / populated states.
 * Extracted from `spa/services/page.tsx` during Phase 2 Agent-07 (F5 carve).
 */

import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ServiceWithId } from '@/hooks/useServices';
import { ServiceCard } from './ServiceCard';
import { ServiceCardSkeleton } from './ServiceCardSkeleton';

export interface ServicesGridProps {
  services: ServiceWithId[] | undefined;
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (service: ServiceWithId) => void;
  onDelete: (serviceId: string) => void;
}

export function ServicesGrid({ services, isLoading, onAdd, onEdit, onDelete }: ServicesGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ServiceCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <Card className="border-0 shadow-lg rounded-2xl">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Services Yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Start by adding your first service offering.
          </p>
          <Button
            onClick={onAdd}
            className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
