import { Skeleton } from '@/components/ui/LoadingState';
import type { SpaServiceWithId } from '@/hooks/useServices';
import { ServiceCard } from './ServiceCard';

interface ServiceListStepProps {
  spaServices: SpaServiceWithId[];
  isLoading: boolean;
  selectedServices: Array<{ id: string; quantity: number }>;
  onToggle: (serviceId: string) => void;
  onQuantityChange: (serviceId: string, delta: number) => void;
}

export function ServiceListStep({
  spaServices,
  isLoading,
  selectedServices,
  onToggle,
  onQuantityChange,
}: ServiceListStepProps) {
  return (
    <div className="p-5 space-y-3">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-6 w-16 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      ) : spaServices.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No services available.</div>
      ) : (
        spaServices.map((service) => {
          const isSelected = selectedServices.some((s) => s.id === service.id);
          const selected = selectedServices.find((s) => s.id === service.id);
          return (
            <ServiceCard
              key={service.id}
              service={service}
              selected={isSelected}
              quantity={selected?.quantity || 1}
              onToggle={() => onToggle(service.id)}
              onQuantityChange={(delta) => onQuantityChange(service.id, delta)}
            />
          );
        })
      )}
    </div>
  );
}
