'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

const BRAND_TEXTS = ['Glamornate', 'Premium Spa'] as const;
const DISPLAY_DURATION = 10000;
const DISSOLVE_DURATION = 700;

type Phase = 'visible' | 'dissolving' | 'entering';

export default function AnimatedBrandName() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('visible');
  const outerTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const innerTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const cycle = useCallback(() => {
    setPhase('dissolving');

    outerTimerRef.current = setTimeout(() => {
      setIndex((prev) => (prev + 1) % BRAND_TEXTS.length);
      setPhase('entering');

      innerTimerRef.current = setTimeout(() => {
        setPhase('visible');
      }, DISSOLVE_DURATION);
    }, DISSOLVE_DURATION);
  }, []);

  useEffect(() => {
    const timer = setInterval(cycle, DISPLAY_DURATION + DISSOLVE_DURATION * 2);
    return () => {
      clearInterval(timer);
      clearTimeout(outerTimerRef.current);
      clearTimeout(innerTimerRef.current);
    };
  }, [cycle]);

  return (
    <span
      className={cn(
        'inline-block text-lg font-serif font-semibold gradient-text-premium',
        'whitespace-nowrap transition-all',
        phase === 'visible' && 'opacity-100 blur-0 translate-y-0 scale-100',
        phase === 'dissolving' && 'opacity-0 blur-[6px] -translate-y-1 scale-[1.02]',
        phase === 'entering' && 'opacity-100 blur-0 translate-y-0 scale-100',
      )}
      style={{
        transitionProperty: 'opacity, filter, transform',
        transitionDuration: `${DISSOLVE_DURATION}ms`,
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {BRAND_TEXTS[index]}
    </span>
  );
}
