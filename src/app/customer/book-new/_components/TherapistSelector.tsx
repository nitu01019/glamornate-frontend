import Image from 'next/image';
import { User } from 'lucide-react';
import { Skeleton } from '@/components/ui/LoadingState';
import type { TherapistWithId } from '@/hooks/useTherapists';

// Therapist selection
export function TherapistSelector({
  therapists,
  selected,
  onSelect,
  isLoading,
}: {
  therapists: TherapistWithId[];
  selected: TherapistWithId | null;
  onSelect: (therapist: TherapistWithId | null) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2 p-3">
            <Skeleton className="w-14 h-14 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
          selected === null ? 'bg-brand-maroon-50 ring-2 ring-brand-maroon-500' : 'bg-white'
        }`}
      >
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <User className="w-6 h-6 text-gray-400" />
        </div>
        <span className="text-sm font-medium text-gray-700">Any</span>
      </button>
      {therapists.map((therapist) => (
        <button
          key={therapist.id}
          onClick={() => onSelect(therapist)}
          className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
            selected?.id === therapist.id
              ? 'bg-brand-maroon-50 ring-2 ring-brand-maroon-500'
              : 'bg-white'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100 flex items-center justify-center overflow-hidden relative">
            {therapist.photo ? (
              <Image
                src={therapist.photo}
                alt={therapist.name}
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <span className="text-lg font-semibold text-brand-maroon-500">
                {(therapist.displayName || therapist.name)?.charAt(0)}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700 max-w-[80px] truncate">
            {therapist.displayName || therapist.name}
          </span>
        </button>
      ))}
    </div>
  );
}
