import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/LoadingState';
import type { SpaWithId } from '@/hooks/useSpas';
import { SpaCard } from './SpaCard';

interface SpaListStepProps {
  spas: SpaWithId[];
  isLoading: boolean;
  error: unknown;
  selectedSpa: SpaWithId | null;
  onSelect: (spa: SpaWithId) => void;
  onRetry: () => void;
}

export function SpaListStep({
  spas,
  isLoading,
  error,
  selectedSpa,
  onSelect,
  onRetry,
}: SpaListStepProps) {
  return (
    <div className="p-5 space-y-3">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4">
              <div className="flex gap-4">
                <Skeleton className="w-20 h-20 rounded-xl flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load spas"
          message="Please try again."
          showRetry
          onRetry={onRetry}
        />
      ) : spas.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No spas available.</div>
      ) : (
        spas.map((spa) => (
          <SpaCard
            key={spa.id}
            spa={spa}
            selected={selectedSpa?.id === spa.id}
            onSelect={() => onSelect(spa)}
          />
        ))
      )}
    </div>
  );
}
