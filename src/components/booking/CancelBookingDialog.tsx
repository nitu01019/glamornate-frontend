'use client';

/**
 * Cancel-booking confirmation dialog.
 *
 * Phase 4.5 (Booking Flow Fix v3.1, 2026-05-02): the legacy dialog talked
 * about a refund-percentage matrix that no longer exists post-Stripe.
 * This rewrite tells the truth — there's nothing to refund, the slot
 * releases immediately — and keeps focus on the secondary "Keep
 * booking" button to nudge users away from accidental cancellations.
 */
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CANCEL_NO_REFUND } from '@/lib/booking/copy';

export interface CancelBookingDialogProps {
  open: boolean;
  isCancelling?: boolean;
  onConfirm(): void;
  onClose(): void;
}

export function CancelBookingDialog({
  open,
  isCancelling = false,
  onConfirm,
  onClose,
}: CancelBookingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            {CANCEL_NO_REFUND} Your slot will be released immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" autoFocus onClick={onClose} disabled={isCancelling}>
            Keep booking
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isCancelling}>
            {isCancelling ? 'Cancelling…' : 'Cancel booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
