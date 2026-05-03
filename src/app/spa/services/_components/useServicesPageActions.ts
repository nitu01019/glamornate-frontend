'use client';

/**
 * Page-level orchestration hook for the spa-owner Services page.
 *
 * Composes dialog state (add/edit form + delete confirm) and wires the
 * submit/delete callbacks against the mutation hooks supplied by the shell.
 * Extracted from `useServicesData.ts` during Phase 2 Agent-07 (F5 carve) so
 * both files stay under the 300-LoC guardrail.
 *
 * See: /docs/remediation/NEXT_SESSION_PLAN.md §Phase2-Agent-07
 */

import { useCallback, useState } from 'react';
import { logger } from '@/lib/logger';
import type { ServiceWithId } from '@/hooks/useServices';
import {
  initialFormData,
  type ServiceFormData,
  type ToastVariant,
  type useCreateService,
  type useDeleteService,
  type useUpdateService,
} from './useServicesData';

export interface ServicesPageActions {
  // Dialog state
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  editingService: ServiceWithId | null;
  formData: ServiceFormData;
  setFormData: (next: ServiceFormData) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;

  // Orchestrated callbacks
  openAddDialog: () => void;
  openEditDialog: (service: ServiceWithId) => void;
  closeDialog: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleDelete: (serviceId: string) => Promise<void>;

  // Pending flags
  submitPending: boolean;
  deletePending: boolean;
}

export interface ServicesPageActionsDeps {
  createService: ReturnType<typeof useCreateService>;
  updateService: ReturnType<typeof useUpdateService>;
  deleteService: ReturnType<typeof useDeleteService>;
  showToast: (title: string, description?: string, variant?: ToastVariant) => void;
}

export function useServicesPageActions(deps: ServicesPageActionsDeps): ServicesPageActions {
  const { createService, updateService, deleteService, showToast } = deps;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithId | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(initialFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openAddDialog = useCallback(() => {
    setEditingService(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((service: ServiceWithId) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category,
      description: service.description,
      baseDuration: service.baseDuration,
      basePrice: service.basePrice,
      benefits: service.benefits || [],
      tags: service.tags || [],
      images: service.images || [],
      recommendedFor: service.recommendedFor || 'all',
      isActive: service.isActive,
      ordering: service.ordering || 0,
    });
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingService(null);
    setFormData(initialFormData);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) {
        showToast('Error', 'Service name is required', 'destructive');
        return;
      }
      try {
        if (editingService) {
          await updateService.mutateAsync({ serviceId: editingService.id, data: formData });
          showToast('Success', 'Service updated successfully', 'success');
        } else {
          await createService.mutateAsync(formData);
          showToast('Success', 'Service created successfully', 'success');
        }
        closeDialog();
      } catch (err) {
        logger.error('Error saving service', err, { component: 'spa/services' });
        showToast('Error', 'Failed to save service', 'destructive');
      }
    },
    [editingService, formData, createService, updateService, closeDialog, showToast],
  );

  const handleDelete = useCallback(
    async (serviceId: string) => {
      try {
        await deleteService.mutateAsync(serviceId);
        showToast('Success', 'Service deleted successfully', 'success');
        setDeleteConfirmId(null);
      } catch (err) {
        logger.error('Error deleting service', err, { component: 'spa/services' });
        showToast('Error', 'Failed to delete service', 'destructive');
      }
    },
    [deleteService, showToast],
  );

  return {
    isDialogOpen,
    setIsDialogOpen,
    editingService,
    formData,
    setFormData,
    deleteConfirmId,
    setDeleteConfirmId,
    openAddDialog,
    openEditDialog,
    closeDialog,
    handleSubmit,
    handleDelete,
    submitPending: createService.isPending || updateService.isPending,
    deletePending: deleteService.isPending,
  };
}
