import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TherapistWithId } from '@/hooks/useTherapists';

interface DeleteStaffDialogProps {
  staff: TherapistWithId | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteStaffDialog({
  staff,
  isDeleting,
  onOpenChange,
  onConfirm,
  onCancel,
}: DeleteStaffDialogProps) {
  return (
    <Dialog open={!!staff} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Staff Member</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-slate-600">
            Are you sure you want to delete <strong>{staff?.name}</strong>? This action cannot be
            undone.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
