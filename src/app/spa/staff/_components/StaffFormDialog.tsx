import { Loader2 } from 'lucide-react';
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TherapistWithId } from '@/hooks/useTherapists';
import type { StaffFormData } from '../_types';

interface StaffFormDialogProps {
  open: boolean;
  editingStaff: TherapistWithId | null;
  formData: StaffFormData;
  specialtyInput: string;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: StaffFormData) => void;
  onSpecialtyInputChange: (value: string) => void;
  onAddSpecialty: () => void;
  onRemoveSpecialty: (specialty: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function StaffFormDialog({
  open,
  editingStaff,
  formData,
  specialtyInput,
  isSaving,
  onOpenChange,
  onFormDataChange,
  onSpecialtyInputChange,
  onAddSpecialty,
  onRemoveSpecialty,
  onSubmit,
  onCancel,
}: StaffFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Staff photo */}
          <div className="flex justify-center">
            <AvatarUpload
              currentPhoto={formData.photo || undefined}
              onPhotoChange={(url) => onFormDataChange({ ...formData, photo: url })}
              userId={editingStaff?.id ?? 'new'}
              storagePath={`therapists/${editingStaff?.id ?? 'new'}/profile`}
              size={80}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Jane Doe"
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g., Jane"
                value={formData.displayName}
                onChange={(e) => onFormDataChange({ ...formData, displayName: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value: 'male' | 'female' | 'other') =>
                  onFormDataChange({ ...formData, gender: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="experience">Years of Experience</Label>
              <Input
                id="experience"
                type="number"
                min="0"
                placeholder="0"
                value={formData.yearsOfExperience}
                onChange={(e) =>
                  onFormDataChange({
                    ...formData,
                    yearsOfExperience: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div>
            <Label>Specialties</Label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="e.g., Massage, Facial"
                value={specialtyInput}
                onChange={(e) => onSpecialtyInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddSpecialty();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={onAddSpecialty}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.specialties.map((spec) => (
                <span
                  key={spec}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm"
                >
                  {spec}
                  <button
                    type="button"
                    onClick={() => onRemoveSpecialty(spec)}
                    className="text-amber-700 hover:text-amber-900"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Brief description about the therapist..."
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-amber-500 to-amber-600"
            onClick={onSubmit}
            disabled={isSaving || !formData.name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {editingStaff ? 'Saving...' : 'Adding...'}
              </>
            ) : editingStaff ? (
              'Save Changes'
            ) : (
              'Add Staff'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
