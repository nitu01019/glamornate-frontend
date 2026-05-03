'use client';

/**
 * Data hooks for the spa-owner Services page.
 *
 * Scopes everything to the `spas/{spaId}/services` subcollection so the owner
 * only sees the service catalog for their own spa. Extracted from
 * `spa/services/page.tsx` during Phase 2 Agent-07 (F5 carve).
 *
 * See: /docs/remediation/NEXT_SESSION_PLAN.md §Phase2-Agent-07
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firebaseClientWrapper } from '@/lib/firebase-client-wrapper';
import type { ServiceWithId } from '@/hooks/useServices';
import type { SpaCategory, Spa } from '@/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ServiceFormData {
  name: string;
  category: SpaCategory;
  description: string;
  baseDuration: number;
  basePrice: number;
  benefits: string[];
  tags: string[];
  images: string[];
  recommendedFor: 'all' | 'men' | 'women';
  isActive: boolean;
  ordering: number;
}

export const initialFormData: ServiceFormData = {
  name: '',
  category: 'massage',
  description: '',
  baseDuration: 60,
  basePrice: 0,
  benefits: [],
  tags: [],
  images: [],
  recommendedFor: 'all',
  isActive: true,
  ordering: 0,
};

export const categoryOptions: { value: SpaCategory; label: string }[] = [
  { value: 'massage', label: 'Massage' },
  { value: 'facial', label: 'Facial' },
  { value: 'body', label: 'Body Treatment' },
  { value: 'pedicure', label: 'Pedicure' },
  { value: 'manicure', label: 'Manicure' },
  { value: 'wellness', label: 'Wellness' },
];

export type ToastVariant = 'default' | 'destructive' | 'success' | 'amber';

export interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

// ---------------------------------------------------------------------------
// Toast hook
// ---------------------------------------------------------------------------

export function useToastNotifications() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (
    title: string,
    description?: string,
    variant: ToastVariant = 'default',
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, showToast, removeToast };
}

// ---------------------------------------------------------------------------
// Query + mutations
// ---------------------------------------------------------------------------

export function useServicesQuery(spaId: string | undefined) {
  return useQuery<ServiceWithId[]>({
    queryKey: ['services', 'spa', spaId],
    queryFn: async (): Promise<ServiceWithId[]> => {
      if (!spaId) return [];
      const result = await firebaseClientWrapper.getSubcollectionDocuments<Record<string, unknown>>(
        'spas',
        spaId,
        'services',
        [{ type: 'orderBy', field: 'ordering', direction: 'asc' }],
      );
      return result.documents.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data as unknown as Omit<ServiceWithId, 'id'>),
      }));
    },
    enabled: !!spaId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSpaByOwnerQuery(spaId: string | undefined) {
  return useQuery<({ id: string } & Spa) | null>({
    queryKey: ['spa-by-owner', spaId],
    queryFn: async () => {
      if (!spaId) return null;
      const result = await firebaseClientWrapper.getDocument<Spa>('spas', spaId);
      if (!result) return null;
      return { id: result.id, ...result.data };
    },
    enabled: !!spaId,
  });
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function useCreateService(spaId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceFormData): Promise<string> => {
      if (!spaId) throw new Error('No spa ID available');

      const newService = {
        name: data.name,
        slug: slugifyName(data.name),
        category: data.category,
        description: data.description,
        benefits: data.benefits,
        baseDuration: data.baseDuration,
        durationVariants: [data.baseDuration],
        basePrice: data.basePrice,
        currency: 'INR',
        recommendedFor: data.recommendedFor,
        tags: data.tags,
        icon: data.category,
        images: data.images,
        addOns: [],
        isActive: data.isActive,
        ordering: data.ordering,
      };

      return firebaseClientWrapper.createSubcollectionDocument(
        'spas',
        spaId,
        'services',
        newService,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', 'spa', spaId] });
    },
  });
}

export function useUpdateService(spaId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      serviceId,
      data,
    }: {
      serviceId: string;
      data: Partial<ServiceFormData>;
    }) => {
      if (!spaId) throw new Error('No spa ID available');

      const slug = data.name ? slugifyName(data.name) : undefined;

      await firebaseClientWrapper.updateSubcollectionDocument(
        'spas',
        spaId,
        'services',
        serviceId,
        {
          ...data,
          ...(slug && { slug }),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', 'spa', spaId] });
    },
  });
}

export function useDeleteService(spaId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceId: string) => {
      if (!spaId) throw new Error('No spa ID available');
      await firebaseClientWrapper.deleteSubcollectionDocument('spas', spaId, 'services', serviceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', 'spa', spaId] });
    },
  });
}
