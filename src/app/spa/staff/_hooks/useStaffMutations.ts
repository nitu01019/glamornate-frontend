'use client';

import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-provider';
import { firebaseClientWrapper } from '@/lib/firebase-client-wrapper';
import type { Therapist } from '@/types';

// Mutation hook for creating a therapist
export function useCreateTherapist() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (therapistData: Partial<Therapist>): Promise<string> => {
      const spaId = user?.spaData?.spaId;

      if (!spaId) {
        throw new Error('No spa ID found for this user');
      }

      const slug =
        therapistData.name
          ?.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '') || '';

      const newTherapist = {
        name: therapistData.name || '',
        slug,
        displayName: therapistData.displayName || therapistData.name || '',
        photo: therapistData.photo || '',
        spaId,
        description: therapistData.description || '',
        specialties: therapistData.specialties || [],
        certifications: [],
        yearsOfExperience: therapistData.yearsOfExperience || 0,
        languages: therapistData.languages || ['English'],
        gender: therapistData.gender || 'other',
        rating: {
          overall: 0,
          count: 0,
          breakdown: {
            ambiance: 0,
            service: 0,
            hygiene: 0,
            therapist: 0,
          },
        },
        status: 'offline',
        onLeave: false,
        availability: {
          monday: { open: '09:00', close: '18:00', isOpen: true },
          tuesday: { open: '09:00', close: '18:00', isOpen: true },
          wednesday: { open: '09:00', close: '18:00', isOpen: true },
          thursday: { open: '09:00', close: '18:00', isOpen: true },
          friday: { open: '09:00', close: '18:00', isOpen: true },
          saturday: { open: '10:00', close: '16:00', isOpen: true },
          sunday: { open: '10:00', close: '16:00', isOpen: false },
        },
        commission: {
          percentage: 0,
          flatRate: 0,
        },
        statistics: {
          totalBookings: 0,
          revenue: 0,
          avgRating: 0,
        },
        isActive: true,
      };

      const result = await firebaseClientWrapper.createDocument('therapists', newTherapist);
      return result; // createDocument returns the document ID directly
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapists'] });
    },
  });
}

// Mutation hook for updating a therapist
export function useUpdateTherapist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      therapistId,
      data,
    }: {
      therapistId: string;
      data: Partial<Therapist>;
    }) => {
      const updateData: Record<string, unknown> = {
        ...data,
      };

      // Update slug if name changed
      if (data.name) {
        updateData.slug = data.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        if (!data.displayName) {
          updateData.displayName = data.name;
        }
      }

      await firebaseClientWrapper.updateDocument('therapists', therapistId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapists'] });
    },
  });
}

// Mutation hook for deleting a therapist
export function useDeleteTherapist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (therapistId: string) => {
      await firebaseClientWrapper.deleteDocument('therapists', therapistId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapists'] });
    },
  });
}

// Mutation hook for updating therapist status
export function useUpdateTherapistStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      therapistId,
      status,
    }: {
      therapistId: string;
      status: 'online' | 'offline';
    }) => {
      await firebaseClientWrapper.updateDocument('therapists', therapistId, {
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapists'] });
    },
  });
}
