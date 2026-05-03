// Step indicator component
export function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        return (
          <div
            key={i}
            data-testid="booking-progress-step"
            data-step-index={stepNumber}
            data-step-state={
              isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'
            }
            className={`h-2 rounded-full transition-all duration-300 ${
              isCurrent
                ? 'w-8 bg-brand-maroon-500'
                : isCompleted
                ? 'w-2 bg-brand-maroon-500'
                : 'w-2 bg-gray-200'
            }`}
          />
        );
      })}
    </div>
  );
}
