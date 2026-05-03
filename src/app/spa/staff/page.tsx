'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import { useSpaTherapists, type TherapistWithId } from '@/hooks/useTherapists';
import { logger } from '@/lib/logger';
import { DeleteStaffDialog } from './_components/DeleteStaffDialog';
import { StaffFormDialog } from './_components/StaffFormDialog';
import { StaffList } from './_components/StaffList';
import { StaffSearchBar } from './_components/StaffSearchBar';
import { StaffStats } from './_components/StaffStats';
import {
  useCreateTherapist,
  useDeleteTherapist,
  useUpdateTherapist,
} from './_hooks/useStaffMutations';
import { initialFormData, type MutationFeedback, type StaffFormData } from './_types';

function SpaStaffContent() {
  const { user } = useAuth();
  const spaId = user?.spaData?.spaId;

  const [isAdding, setIsAdding] = useState(false);
  const [editingStaff, setEditingStaff] = useState<TherapistWithId | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<TherapistWithId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<StaffFormData>(initialFormData);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [feedback, setFeedback] = useState<MutationFeedback>(null);

  const { data: therapists = [], isLoading, error, refetch } = useSpaTherapists(spaId);
  const createTherapist = useCreateTherapist();
  const updateTherapist = useUpdateTherapist();
  const deleteTherapist = useDeleteTherapist();

  // Filter therapists based on search query
  const filteredTherapists = therapists.filter((therapist) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      therapist.name.toLowerCase().includes(query) ||
      therapist.displayName.toLowerCase().includes(query) ||
      therapist.specialties.some((s) => s.toLowerCase().includes(query))
    );
  });

  // Calculate stats
  const stats = {
    total: therapists.length,
    online: therapists.filter((t) => t.status === 'online').length,
    onLeave: therapists.filter((t) => t.onLeave).length,
    totalBookings: therapists.reduce((sum, t) => sum + (t.statistics?.totalBookings || 0), 0),
  };

  const handleOpenAddDialog = () => {
    setFormData(initialFormData);
    setIsAdding(true);
  };

  const handleOpenEditDialog = (therapist: TherapistWithId) => {
    setFormData({
      name: therapist.name,
      displayName: therapist.displayName,
      photo: therapist.photo || '',
      role: therapist.specialties[0] || '',
      email: '',
      phone: '',
      specialties: therapist.specialties,
      yearsOfExperience: therapist.yearsOfExperience || 0,
      gender: therapist.gender || 'other',
      description: therapist.description || '',
    });
    setEditingStaff(therapist);
  };

  const handleAddSpecialty = () => {
    if (specialtyInput.trim() && !formData.specialties.includes(specialtyInput.trim())) {
      setFormData({
        ...formData,
        specialties: [...formData.specialties, specialtyInput.trim()],
      });
      setSpecialtyInput('');
    }
  };

  const handleRemoveSpecialty = (specialty: string) => {
    setFormData({
      ...formData,
      specialties: formData.specialties.filter((s) => s !== specialty),
    });
  };

  const resetDialog = () => {
    setIsAdding(false);
    setEditingStaff(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    try {
      if (editingStaff) {
        await updateTherapist.mutateAsync({
          therapistId: editingStaff.id!,
          data: {
            name: formData.name,
            displayName: formData.displayName || formData.name,
            photo: formData.photo,
            specialties: formData.specialties,
            yearsOfExperience: formData.yearsOfExperience,
            gender: formData.gender,
            description: formData.description,
          },
        });
        setEditingStaff(null);
        setFeedback({ type: 'success', message: 'Staff member updated successfully.' });
      } else {
        await createTherapist.mutateAsync({
          name: formData.name,
          displayName: formData.displayName || formData.name,
          photo: formData.photo,
          specialties: formData.specialties,
          yearsOfExperience: formData.yearsOfExperience,
          gender: formData.gender,
          description: formData.description,
        });
        setIsAdding(false);
        setFeedback({ type: 'success', message: 'Staff member added successfully.' });
      }
      setFormData(initialFormData);
      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      logger.error('Error saving therapist', error, { component: 'spa/staff' });
      setFeedback({ type: 'error', message: 'Failed to save staff member. Please try again.' });
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleDelete = async () => {
    if (!deletingStaff) return;
    try {
      await deleteTherapist.mutateAsync(deletingStaff.id!);
      setDeletingStaff(null);
      setFeedback({ type: 'success', message: 'Staff member removed successfully.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      logger.error('Error deleting therapist', error, { component: 'spa/staff' });
      setDeletingStaff(null);
      setFeedback({ type: 'error', message: 'Failed to remove staff member. Please try again.' });
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const isSaving = createTherapist.isPending || updateTherapist.isPending;

  // Error state
  if (error) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <Card className="border-0 shadow-lg rounded-2xl max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Staff</h2>
            <p className="text-sm text-gray-500 mb-4">
              {error instanceof Error
                ? error.message
                : 'An error occurred while loading staff data.'}
            </p>
            <Button
              onClick={() => refetch()}
              className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No spa ID state
  if (!spaId) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <Card className="border-0 shadow-lg rounded-2xl max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Spa Associated</h2>
            <p className="text-sm text-gray-500 mb-4">
              Your account is not associated with any spa.
            </p>
            <Link href="/spa/dashboard">
              <Button className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Mutation feedback banner */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <p className="text-sm font-medium">{feedback.message}</p>
        </div>
      )}

      <StaffSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={handleOpenAddDialog}
      />

      <StaffStats stats={stats} isLoading={isLoading} />

      <StaffList
        therapists={filteredTherapists}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onEdit={handleOpenEditDialog}
        onDelete={setDeletingStaff}
        onAdd={handleOpenAddDialog}
      />

      <StaffFormDialog
        open={isAdding || !!editingStaff}
        editingStaff={editingStaff}
        formData={formData}
        specialtyInput={specialtyInput}
        isSaving={isSaving}
        onOpenChange={(open) => {
          if (!open) resetDialog();
        }}
        onFormDataChange={setFormData}
        onSpecialtyInputChange={setSpecialtyInput}
        onAddSpecialty={handleAddSpecialty}
        onRemoveSpecialty={handleRemoveSpecialty}
        onSubmit={handleSubmit}
        onCancel={resetDialog}
      />

      <DeleteStaffDialog
        staff={deletingStaff}
        isDeleting={deleteTherapist.isPending}
        onOpenChange={(open) => !open && setDeletingStaff(null)}
        onConfirm={handleDelete}
        onCancel={() => setDeletingStaff(null)}
      />
    </div>
  );
}

export default function SpaStaffPage() {
  return (
    <ProtectedRoute requiredRoles={['spa_owner']}>
      <SpaStaffContent />
    </ProtectedRoute>
  );
}
