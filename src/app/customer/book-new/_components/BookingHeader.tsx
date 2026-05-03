import { ChevronLeft, X } from 'lucide-react';
import { StepIndicator } from './StepIndicator';

interface BookingHeaderProps {
  step: number;
  totalSteps: number;
  stepTitle: string;
  onBack: () => void;
  onClose: () => void;
}

export function BookingHeader({
  step,
  totalSteps,
  stepTitle,
  onBack,
  onClose,
}: BookingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 h-14">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center -ml-2">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-gray-900">{stepTitle}</p>
          <p className="text-xs text-gray-500">
            Step {step} of {totalSteps}
          </p>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center -mr-2">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      <div className="px-8 pb-3">
        <StepIndicator currentStep={step} totalSteps={totalSteps} />
      </div>
    </header>
  );
}
