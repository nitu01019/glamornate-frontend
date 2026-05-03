'use client';

/**
 * Spa-owner Services page — composition shell.
 *
 * Phase 2 Agent-07 (F5 carve, 2026-04-20) extracted this file from a 740-LoC
 * monolith into `_components/` siblings. Each extracted module stays well
 * under the 300-LoC guardrail; this shell composes them and delegates all
 * dialog / mutation orchestration to `useServicesPageActions`. Runtime
 * behavior is preserved.
 *
 * See: /docs/remediation/NEXT_SESSION_PLAN.md §Phase2-Agent-07
 */

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import { DeleteConfirmDialog } from './_components/DeleteConfirmDialog';
import { ServiceFormDialog } from './_components/ServiceFormDialog';
import { ServicesGrid } from './_components/ServicesGrid';
import { ServicesToasts } from './_components/ServicesToasts';
import {
  useCreateService,
  useDeleteService,
  useServicesQuery,
  useSpaByOwnerQuery,
  useToastNotifications,
  useUpdateService,
} from './_components/useServicesData';
import { useServicesPageActions } from './_components/useServicesPageActions';

function SpaServicesContent() {
  const { user } = useAuth();
  const spaId = user?.spaData?.spaId;

  const { toasts, showToast, removeToast } = useToastNotifications();
  const { data: services, isLoading, error, refetch } = useServicesQuery(spaId);
  // Fire-and-forget: warm the spa-by-owner cache for header context.
  useSpaByOwnerQuery(spaId);

  const createService = useCreateService(spaId);
  const updateService = useUpdateService(spaId);
  const deleteService = useDeleteService(spaId);

  const actions = useServicesPageActions({
    createService,
    updateService,
    deleteService,
    showToast,
  });

  if (error) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <ErrorState
          title="Failed to Load Services"
          message="There was an error loading the services. Please try again."
          showRetry
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <ServicesToasts toasts={toasts} onDismiss={removeToast} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {services
            ? `${services.length} service${services.length !== 1 ? 's' : ''} available`
            : 'Manage your services'}
        </p>
        <Button
          onClick={actions.openAddDialog}
          className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full shadow-lg"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      <ServicesGrid
        services={services}
        isLoading={isLoading}
        onAdd={actions.openAddDialog}
        onEdit={actions.openEditDialog}
        onDelete={actions.setDeleteConfirmId}
      />

      <ServiceFormDialog
        open={actions.isDialogOpen}
        onOpenChange={actions.setIsDialogOpen}
        editingService={actions.editingService}
        formData={actions.formData}
        setFormData={actions.setFormData}
        onSubmit={actions.handleSubmit}
        onCancel={actions.closeDialog}
        submitPending={actions.submitPending}
      />

      <DeleteConfirmDialog
        open={!!actions.deleteConfirmId}
        onOpenChange={(open) => !open && actions.setDeleteConfirmId(null)}
        onConfirm={() => actions.deleteConfirmId && actions.handleDelete(actions.deleteConfirmId)}
        onCancel={() => actions.setDeleteConfirmId(null)}
        pending={actions.deletePending}
      />
    </div>
  );
}

export default function SpaServicesPage() {
  return (
    <ProtectedRoute requiredRoles={['spa_owner']}>
      <SpaServicesContent />
    </ProtectedRoute>
  );
}
