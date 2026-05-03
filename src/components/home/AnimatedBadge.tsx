'use client';

import { cn } from '@/lib/utils';
import { useInViewOnce } from '@/hooks/useInViewOnce';

export interface AnimatedBadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'most-booked' | 'editor-pick' | 'new';
  className?: string;
  staggerMs?: number;
}

const VARIANT_CLASSES: Record<NonNullable<AnimatedBadgeProps['variant']>, string> = {
  default: 'bg-brand-maroon-100 text-brand-maroon-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  'most-booked': 'bg-brand-maroon-500 text-white',
  'editor-pick': 'bg-brand-maroon-400 text-white',
  'new': 'bg-brand-maroon-300 text-white',
};

export default function AnimatedBadge({
  label,
  variant = 'default',
  className,
  staggerMs = 0,
}: AnimatedBadgeProps) {
  const { ref, hasEntered } = useInViewOnce({ threshold: 0.15 });

  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      data-testid="animated-badge"
      data-entered={hasEntered ? 'true' : 'false'}
      className={cn(
        'relative inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium overflow-hidden',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {label}
      <span
        data-testid="animated-badge-curtain"
        data-state={hasEntered ? 'revealing' : 'covering'}
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-brand-blush-500',
          hasEntered ? 'animate-curtain-sweep' : '',
        )}
        style={hasEntered && staggerMs > 0 ? { animationDelay: `${staggerMs}ms` } : {}}
      />
    </span>
  );
}
