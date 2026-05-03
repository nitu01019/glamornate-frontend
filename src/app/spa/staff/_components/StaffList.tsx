import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { TherapistWithId } from '@/hooks/useTherapists';
import { StaffListCard } from './StaffListCard';

interface StaffListProps {
  therapists: TherapistWithId[];
  isLoading: boolean;
  searchQuery: string;
  onEdit: (therapist: TherapistWithId) => void;
  onDelete: (therapist: TherapistWithId) => void;
  onAdd: () => void;
}

export function StaffList({
  therapists,
  isLoading,
  searchQuery,
  onEdit,
  onDelete,
  onAdd,
}: StaffListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (therapists.length === 0) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardContent className="p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Staff Found</h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchQuery ? 'No staff members match your search.' : 'Add your first team member.'}
          </p>
          {!searchQuery && (
            <Button
              onClick={onAdd}
              className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {therapists.map((therapist) => (
        <StaffListCard
          key={therapist.id}
          therapist={therapist}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
