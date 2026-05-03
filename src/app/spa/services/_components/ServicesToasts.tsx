'use client';

/**
 * Toast overlay for the spa-owner services page. Extracted from
 * `spa/services/page.tsx` during Phase 2 Agent-07 (F5 carve).
 */

import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import type { ToastMessage } from './useServicesData';

export interface ServicesToastsProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ServicesToasts({ toasts, onDismiss }: ServicesToastsProps) {
  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onOpenChange={(open) => !open && onDismiss(toast.id)}
        >
          <ToastTitle>{toast.title}</ToastTitle>
          {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
