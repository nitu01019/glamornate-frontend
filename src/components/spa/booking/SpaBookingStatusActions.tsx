'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Navigation, LogIn, LogOut, X, Loader2 } from 'lucide-react';
import { useUpdateBookingStatus } from '@/hooks/useBookings';
import type { BookingStatus } from '@/types';
import { logger } from '@/lib/logger';

export interface SpaBookingStatusActionsProps {
  booking: {
    id: string;
    bookingStatus: BookingStatus;
  };
}

interface ActionConfig {
  label: string;
  next: BookingStatus;
  icon: typeof Check;
  variant: 'primary' | 'danger';
}

function getActionsFor(status: BookingStatus): ActionConfig[] {
  switch (status) {
    case 'confirmed':
      return [
        { label: 'Mark En Route', next: 'en_route', icon: Navigation, variant: 'primary' },
        { label: 'Cancel', next: 'cancelled', icon: X, variant: 'danger' },
      ];
    case 'en_route':
      return [{ label: 'Check In Customer', next: 'in_progress', icon: LogIn, variant: 'primary' }];
    case 'in_progress':
      return [{ label: 'Check Out Service', next: 'completed', icon: LogOut, variant: 'primary' }];
    default:
      return [];
  }
}

export function SpaBookingStatusActions({ booking }: SpaBookingStatusActionsProps) {
  const update = useUpdateBookingStatus();
  const actions = getActionsFor(booking.bookingStatus);
  if (actions.length === 0) return null;

  const handleClick = async (next: BookingStatus) => {
    try {
      await update.mutateAsync({ bookingId: booking.id, status: next });
    } catch (err) {
      logger.error(
        'Spa booking status update failed',
        err,
        { component: 'SpaBookingStatusActions' },
        { bookingId: booking.id, next },
      );
    }
  };

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-5 space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Actions</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {actions.map((action) => {
            const Icon = action.icon;
            const isPrimary = action.variant === 'primary';
            return (
              <Button
                key={action.next}
                type="button"
                disabled={update.isPending}
                onClick={() => handleClick(action.next)}
                data-testid={`spa-booking-action-${action.next}`}
                className={
                  isPrimary
                    ? 'flex-1 h-11 rounded-xl bg-brand-maroon-500 hover:bg-brand-maroon-600 text-white text-sm font-medium'
                    : 'flex-1 h-11 rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-sm font-medium'
                }
              >
                {update.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4 mr-2" />
                )}
                {action.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
