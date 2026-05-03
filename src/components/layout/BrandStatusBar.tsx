'use client';
import { Sparkles } from 'lucide-react';

interface BrandStatusBarProps {
  readonly className?: string;
}

export function BrandStatusBar({ className }: BrandStatusBarProps = {}) {
  return (
    <span
      data-testid="brand-status-bar"
      className={`inline-flex items-center gap-1 text-xs font-medium text-brand-maroon-700 ${className ?? ''}`}
    >
      <Sparkles className="w-3.5 h-3.5 text-brand-gold-500" aria-hidden="true" />
      <span className="font-serif">Glamornate</span>
      <span className="text-brand-maroon-500">·</span>
      <span className="font-semibold italic" style={{ color: '#D94674' }}>
        Our Premium
      </span>
    </span>
  );
}

export default BrandStatusBar;
