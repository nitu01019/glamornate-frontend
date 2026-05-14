import Image from 'next/image';
import { Loader2, MapPin, X } from 'lucide-react';
import type { BookingCustomerLocation } from '@/shared/contracts';
import type { SpaWithId } from '@/hooks/useSpas';
import type { TherapistWithId } from '@/hooks/useTherapists';
import type { CartItem } from '@/types';
import { formatTime } from '../_utils/dateHelpers';

interface ConfirmStepProps {
  selectedSpa: SpaWithId | null;
  /** Cart contents — single source of truth for service name/price/duration.
   *  Phase 6 (2026-05-13): the wizard no longer re-derives any of these from
   *  spaServices. Whatever the catalog charged at add-time is what the
   *  Confirm screen shows. Backend `createBookingDraft` recomputes
   *  authoritative pricing server-side from `spa_services`/`services` docs;
   *  this view is intentionally honest about what the cart already says. */
  cartItems: CartItem[];
  selectedDate: Date | null;
  selectedTime: string | null;
  selectedTherapist: TherapistWithId | null;
  bookingLocation: 'spa' | 'home';
  customerLocation: BookingCustomerLocation | null;
  /** Submits the booking via `useBookingSubmission`. */
  onConfirm: () => void;
  /** True while the createBookingDraft mutation is in flight. */
  isCreating: boolean;
  /** Inline error rendered just above the Confirm CTA. Replaces the prior
   *  floating toast at `bottom-32` which overlapped this button and got
   *  dismissed on re-tap (looked like "nothing happened"). */
  errorMessage: string | null;
  onDismissError: () => void;
}

export function ConfirmStep({
  selectedSpa,
  cartItems,
  selectedDate,
  selectedTime,
  selectedTherapist,
  bookingLocation,
  customerLocation,
  onConfirm,
  isCreating,
  errorMessage,
  onDismissError,
}: ConfirmStepProps) {
  const totalDuration = cartItems.reduce((sum, item) => sum + item.duration * item.quantity, 0);
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="p-5 space-y-4">
      {/* Booking location */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Booking location</h3>
        {bookingLocation === 'home' && customerLocation ? (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-brand-maroon-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-gray-900">At your address</p>
              <p className="text-sm text-gray-600">{customerLocation.addressText}</p>
              {customerLocation.additionalDetails ? (
                <p className="text-xs text-gray-500">Notes: {customerLocation.additionalDetails}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-brand-maroon-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900">At {selectedSpa?.name ?? 'the spa'}</p>
              {selectedSpa?.location?.address ? (
                <p className="text-sm text-gray-500">{selectedSpa.location.address}</p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Salon */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Salon</h3>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden relative flex-shrink-0">
            <Image
              src={
                selectedSpa?.featuredImage ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedSpa?.name || 'Spa')}`
              }
              alt={selectedSpa?.name || ''}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{selectedSpa?.name}</p>
            <p className="text-sm text-gray-500">{selectedSpa?.location?.address}</p>
          </div>
        </div>
      </div>

      {/* Services — name, duration, price come directly from the cart
          (which snapshotted them from the catalog at add-time). */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Services</h3>
        <div className="space-y-3">
          {cartItems.map((item) => (
            <div key={item.serviceId} className="flex items-center justify-between">
              <div className="min-w-0 pr-3">
                <p className="font-medium text-gray-900 truncate">{item.serviceName}</p>
                <p className="text-sm text-gray-500">
                  {item.duration} min{item.quantity > 1 ? ` × ${item.quantity}` : ''}
                </p>
              </div>
              <p className="font-semibold text-gray-900 tabular-nums">
                ₹{(item.price * item.quantity).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Schedule</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Date</span>
            <span className="font-medium text-gray-900 tabular-nums">
              {selectedDate?.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Time</span>
            <span className="font-medium text-gray-900 tabular-nums">
              {selectedTime ? formatTime(selectedTime) : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Therapist</span>
            <span className="font-medium text-gray-900">
              {selectedTherapist?.displayName || selectedTherapist?.name || 'Any Available'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Duration</span>
            <span className="font-medium text-gray-900 tabular-nums">{totalDuration} min</span>
          </div>
        </div>
      </div>

      {/* Cancellation Policy */}
      <div className="bg-brand-gold-50 rounded-2xl p-4">
        <p className="text-sm font-medium text-brand-gold-800 mb-2">Cancellation Policy</p>
        <ul className="text-xs text-brand-gold-700 space-y-1">
          <li>• Free cancellation up to 24 hours before</li>
          <li>• 50% refund between 6-24 hours</li>
          <li>• No refund within 6 hours</li>
        </ul>
      </div>

      {/* Inline error alert — replaces the floating toast so the user can
          read the error without it overlapping (and getting dismissed by) a
          re-tap on the Confirm CTA. */}
      {errorMessage ? (
        <div
          role="alert"
          aria-live="polite"
          className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2"
        >
          <p className="text-sm text-red-800 flex-1">{errorMessage}</p>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className="text-red-700 hover:text-red-900 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {/* Confirm CTA — single source of truth for advancing the booking.
          The bottom bar is hidden on Step 3 (page.tsx) so this is the only
          tap target. Label encodes total so the user sees exactly what
          they're committing to. */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={isCreating}
        aria-disabled={isCreating}
        aria-busy={isCreating}
        className={`w-full min-h-[56px] rounded-2xl text-white font-semibold transition-all flex items-center justify-center gap-2 ${
          isCreating
            ? 'bg-gray-300 text-gray-500'
            : 'bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 active:scale-[0.99] shadow-md'
        }`}
      >
        {isCreating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Confirming…
          </>
        ) : (
          <>Confirm booking · ₹{total.toLocaleString()}</>
        )}
      </button>
    </div>
  );
}
