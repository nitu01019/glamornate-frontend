'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useBookingStore } from '@/store/booking';
import { useCartStore } from '@/store/cart';
import LocationStep from '@/components/booking/LocationStep';
import DateTimeStep from '@/components/booking/DateTimeStep';
import ReviewStep from '@/components/booking/ReviewStep';
import ConfirmationStep from '@/components/booking/ConfirmationStep';

const STEPS = [
  { label: 'Location' },
  { label: 'Date & Time' },
  { label: 'Review' },
  { label: 'Confirmed' },
] as const;

export default function BookingPage() {
  const step = useBookingStore((s) => s.step);
  const nextStep = useBookingStore((s) => s.nextStep);
  const prevStep = useBookingStore((s) => s.prevStep);
  const items = useCartStore((s) => s.items);
  const hasHydrated = useCartStore((s) => s._hasHydrated);

  // Don't render until the cart store has rehydrated from localStorage
  if (!hasHydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-maroon-500 border-t-transparent" />
      </div>
    );
  }

  // Show empty state instead of redirecting — less disorienting for users
  if (items.length === 0 && step < 4) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center animate-fade-in">
        <div className="text-5xl">🛒</div>
        <h2 className="text-xl font-bold text-gray-900">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground">
          Browse our services to add items before booking.
        </p>
        <Link
          href="/services"
          className="mt-2 rounded-full bg-brand-maroon-500 px-6 py-2.5 text-sm font-semibold text-white shadow-maroon transition-opacity hover:opacity-90 active:scale-95"
        >
          Browse Services
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 animate-fade-in">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const stepNumber = idx + 1;
            const isCompleted = step > stepNumber;
            const isCurrent = step === stepNumber;

            return (
              <div key={s.label} className="flex flex-1 items-center">
                {/* Circle */}
                <div className="flex flex-col items-center">
                  <div
                    data-testid="booking-progress-step"
                    data-step-index={stepNumber}
                    data-step-state={
                      isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'
                    }
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                      isCompleted && 'bg-brand-maroon-500 text-white shadow-maroon',
                      isCurrent &&
                        'border-2 border-brand-maroon-500 bg-white text-brand-maroon-500 shadow-sm',
                      !isCompleted &&
                        !isCurrent &&
                        'border-2 border-gray-200 bg-white text-gray-400'
                    )}
                  >
                    {isCompleted ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      stepNumber
                    )}
                  </div>
                  <span
                    className={cn(
                      'mt-1.5 text-[10px] font-medium transition-colors',
                      isCurrent || isCompleted
                        ? 'text-brand-maroon-600'
                        : 'text-gray-400'
                    )}
                  >
                    {s.label}
                  </span>
                </div>

                {/* Connecting line */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-1.5 h-0.5 flex-1 rounded-full transition-colors duration-300',
                      step > stepNumber ? 'bg-brand-maroon-500' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Step {Math.min(step, STEPS.length)} of {STEPS.length}
        </p>
      </div>

      {/* Step content */}
      <div
        data-testid="booking-step-content"
        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card animate-fade-in-up"
      >
        {step === 1 && <LocationStep onNext={nextStep} />}
        {step === 2 && <DateTimeStep onNext={nextStep} onBack={prevStep} />}
        {step === 3 && <ReviewStep onNext={nextStep} onBack={prevStep} />}
        {step === 4 && <ConfirmationStep />}
      </div>
    </div>
  );
}
