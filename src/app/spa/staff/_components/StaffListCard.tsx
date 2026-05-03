import { Calendar, Edit, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { TherapistWithId } from '@/hooks/useTherapists';
import { StaffStatusBadge, StaffStatusIndicator } from './StaffStatusBadge';

export function StaffListCard({
  therapist,
  onEdit,
  onDelete,
}: {
  therapist: TherapistWithId;
  onEdit: (therapist: TherapistWithId) => void;
  onDelete: (therapist: TherapistWithId) => void;
}) {
  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {therapist.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- therapist.photo is an arbitrary external URL (spa-controlled, not in `next.config` remotePatterns); next/image would require an allowlist per spa. Migration deferred until signed-URL hook (SEC-L5) lands.
              <img
                src={therapist.photo}
                alt={therapist.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-blue-700">
                  {therapist.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5">
              <StaffStatusIndicator status={therapist.status} onLeave={therapist.onLeave} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">
                {therapist.displayName || therapist.name}
              </h3>
              <StaffStatusBadge status={therapist.status} onLeave={therapist.onLeave} />
            </div>
            <p className="text-sm text-gray-500 truncate">
              {therapist.specialties[0] || 'Therapist'}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                {therapist.rating?.overall?.toFixed(1) || '0.0'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {therapist.statistics?.totalBookings || 0}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(therapist)}
            >
              <Edit className="w-4 h-4 text-gray-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-500"
              onClick={() => onDelete(therapist)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
