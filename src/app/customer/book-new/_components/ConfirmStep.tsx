import Image from 'next/image';
import { MapPin } from 'lucide-react';
import type { BookingCustomerLocation } from '@glamornate/contracts';
import type { SpaServiceWithId } from '@/hooks/useServices';
import type { SpaWithId } from '@/hooks/useSpas';
import type { TherapistWithId } from '@/hooks/useTherapists';
import { formatTime } from '../_utils/dateHelpers';

interface ConfirmStepProps {
  selectedSpa: SpaWithId | null;
  selectedServices: Array<{ id: string; quantity: number }>;
  spaServices: SpaServiceWithId[];
  selectedDate: Date | null;
  selectedTime: string | null;
  selectedTherapist: TherapistWithId | null;
  totalDuration: number;
  subtotal: number;
  tax: number;
  total: number;
  bookingLocation: 'spa' | 'home';
  customerLocation: BookingCustomerLocation | null;
}

export function ConfirmStep({
  selectedSpa,
  selectedServices,
  spaServices,
  selectedDate,
  selectedTime,
  selectedTherapist,
  totalDuration,
  subtotal,
  tax,
  total,
  bookingLocation,
  customerLocation,
}: ConfirmStepProps) {
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
                <p className="text-xs text-gray-500">
                  Notes: {customerLocation.additionalDetails}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-brand-maroon-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900">
                At {selectedSpa?.name ?? 'the spa'}
              </p>
              {selectedSpa?.location?.address ? (
                <p className="text-sm text-gray-500">{selectedSpa.location.address}</p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Spa */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Spa</h3>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden relative flex-shrink-0">
            <Image
              src={
                selectedSpa?.featuredImage ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  selectedSpa?.name || 'Spa',
                )}`
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

      {/* Services */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Services</h3>
        <div className="space-y-3">
          {selectedServices.map((selected) => {
            const spaService = spaServices.find((s) => s.id === selected.id);
            const price = spaService?.priceOverride ?? spaService?.service?.basePrice ?? 0;
            const name = spaService?.customName || spaService?.service?.name || 'Service';
            const duration =
              spaService?.durationOverride ?? spaService?.service?.baseDuration ?? 60;
            return (
              <div key={selected.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{name}</p>
                  <p className="text-sm text-gray-500">
                    {duration} min {selected.quantity > 1 && `× ${selected.quantity}`}
                  </p>
                </div>
                <p className="font-semibold text-gray-900">
                  ₹{(price * selected.quantity).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Schedule</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Date</span>
            <span className="font-medium text-gray-900">
              {selectedDate?.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Time</span>
            <span className="font-medium text-gray-900">
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
            <span className="font-medium text-gray-900">{totalDuration} min</span>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Payment Summary</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-gray-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Taxes (18%)</span>
            <span>₹{tax.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Platform Fee</span>
            <span>₹50</span>
          </div>
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-brand-maroon-500">
              ₹{total.toLocaleString()}
            </span>
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
    </div>
  );
}
