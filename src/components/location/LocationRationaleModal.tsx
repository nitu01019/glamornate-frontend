'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const TITLE_ID = 'location-rationale-title';
const DESC_ID = 'location-rationale-desc';

interface LocationRationaleModalProps {
  open: boolean;
  onAllow: () => void;
  onDeny: () => void;
  onClose?: () => void;
}

export function LocationRationaleModal({
  open,
  onAllow,
  onDeny,
  onClose,
}: LocationRationaleModalProps) {
  const primaryRef = React.useRef<HTMLButtonElement>(null);

  // Move focus to primary button when dialog opens.
  React.useEffect(() => {
    if (open) {
      // Radix finishes its own focus management on the next tick.
      const id = setTimeout(() => {
        primaryRef.current?.focus();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Escape key is handled natively by Radix Dialog — we wire it to our
  // onClose/onDeny callback via the onEscapeKeyDown event.
  const handleEscape = React.useCallback(() => {
    const close = onClose ?? onDeny;
    close();
  }, [onClose, onDeny]);

  const handleAllow = React.useCallback(() => {
    onAllow();
  }, [onAllow]);

  const handleDeny = React.useCallback(() => {
    onDeny();
  }, [onDeny]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        const close = onClose ?? onDeny;
        close();
      }
    }}>
      <DialogContent
        // Radix already sets role="dialog" and aria-modal="true" on the
        // Content element; we reinforce with explicit aria-* linkage.
        aria-labelledby={TITLE_ID}
        aria-describedby={DESC_ID}
        // Prevent the built-in X close button from rendering — callers
        // should use the two action buttons to drive state.
        className="sm:max-w-sm gap-6 pb-8"
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleEscape();
        }}
        // Prevent clicking the overlay from silently dismissing without
        // calling the correct callback.
        onInteractOutside={(e) => {
          e.preventDefault();
          handleEscape();
        }}
      >
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle
            id={TITLE_ID}
            className="text-base font-semibold text-foreground"
          >
            Use your current location?
          </DialogTitle>
          <DialogDescription
            id={DESC_ID}
            className="text-sm text-muted-foreground mt-2 leading-relaxed"
          >
            To find spas near you, Glamornate needs access to your location.
            Your location is only used while you&apos;re actively searching and
            is never stored.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button
            ref={primaryRef}
            variant="default"
            size="lg"
            className="w-full"
            onClick={handleAllow}
          >
            Allow location access
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={handleDeny}
          >
            Enter address manually
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
