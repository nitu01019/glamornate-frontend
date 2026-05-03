import { ChevronRight, Loader2 } from 'lucide-react';

interface BookingBottomBarProps {
  step: number;
  totalSteps: number;
  selectedServices: Array<{ id: string; quantity: number }>;
  total: number;
  subtotal: number;
  isCreating: boolean;
  canProceed: boolean;
  onNext: () => void;
  onConfirm: () => void;
}

export function BookingBottomBar({
  step,
  totalSteps,
  selectedServices,
  total,
  subtotal,
  isCreating,
  canProceed,
  onNext,
  onConfirm,
}: BookingBottomBarProps) {
  const isFinalStep = step === totalSteps;
  const isDisabled = !canProceed || isCreating;
  // Patch DR-9 (a11y): Confirm button accessible name flips between idle and
  // busy ("Confirm" → "Confirming…"). Continue button uses both `disabled` and
  // `aria-disabled` for screen-reader redundancy. Touch target = h-14 (56px) ≥
  // 44px. Color contrast on disabled (gray-200 / gray-400) tracked separately
  // — brand-maroon palette unchanged per scope.
  const accessibleLabel = isFinalStep
    ? isCreating
      ? 'Confirming…'
      : 'Confirm'
    : 'Continue';
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 safe-area-inset-bottom">
      <div className="flex items-center justify-between gap-4">
        {selectedServices.length > 0 && (
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl font-bold text-gray-900">
              ₹{isFinalStep ? total.toLocaleString() : subtotal.toLocaleString()}
            </p>
          </div>
        )}
        <button
          onClick={isFinalStep ? onConfirm : onNext}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          aria-busy={isCreating}
          aria-label={accessibleLabel}
          className={`flex-1 ${
            selectedServices.length > 0 ? 'max-w-[200px]' : ''
          } min-h-[44px] h-14 rounded-2xl font-semibold text-white transition-all ${
            canProceed && !isCreating
              ? 'bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              Confirming…
            </span>
          ) : isFinalStep ? (
            'Confirm'
          ) : (
            <span className="flex items-center justify-center gap-1">
              Continue
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
