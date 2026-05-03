import { Clock } from 'lucide-react';

interface ReadingTimeBadgeProps {
  readonly minutes: number;
  readonly className?: string;
}

export function ReadingTimeBadge({ minutes, className }: ReadingTimeBadgeProps): JSX.Element {
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 1;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-gray-500 ${className ?? ''}`.trim()}
      aria-label={`${safeMinutes} minute read`}
    >
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{safeMinutes} min read</span>
    </span>
  );
}
