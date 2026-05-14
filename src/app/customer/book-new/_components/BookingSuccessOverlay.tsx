'use client';

/**
 * BookingSuccessOverlay
 * ---------------------
 * Full-screen confirmation overlay shown between a successful booking
 * submission and the navigation to the booking detail page.
 *
 * Brand-coloured, hardware-accelerated, lightweight (~150 LoC, no deps).
 * Animations gracefully degrade via `motion-reduce:`.
 */

import { Check, Sparkles } from 'lucide-react';

interface BookingSuccessOverlayProps {
  readonly open: boolean;
  readonly title?: string;
  readonly subtitle?: string;
}

export function BookingSuccessOverlay({
  open,
  title = 'Booking confirmed!',
  subtitle = "We're getting everything ready for you.",
}: BookingSuccessOverlayProps) {
  if (!open) return null;
  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-brand-maroon-500/95 via-brand-maroon-600/95 to-brand-maroon-700/95 backdrop-blur-sm motion-reduce:bg-brand-maroon-600 animate-fade-in"
    >
      <div className="relative flex flex-col items-center text-center px-8">
        {/* Sparkles decoration */}
        <Sparkles
          className="absolute -top-6 -left-10 w-7 h-7 text-brand-gold-300 opacity-80 animate-sparkle-1 motion-reduce:hidden"
          aria-hidden="true"
        />
        <Sparkles
          className="absolute -top-2 right-0 w-5 h-5 text-brand-gold-200 opacity-70 animate-sparkle-2 motion-reduce:hidden"
          aria-hidden="true"
        />
        <Sparkles
          className="absolute -bottom-4 -right-8 w-6 h-6 text-brand-gold-300 opacity-80 animate-sparkle-3 motion-reduce:hidden"
          aria-hidden="true"
        />

        {/* Check badge with two-stage scale */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-6">
          <div
            className="absolute inset-0 rounded-full bg-white/20 animate-ping-slow motion-reduce:hidden"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 rounded-full bg-white shadow-2xl scale-0 animate-check-pop motion-reduce:scale-100"
            aria-hidden="true"
          />
          <Check
            className="relative w-14 h-14 text-brand-maroon-600 scale-0 animate-check-icon motion-reduce:scale-100"
            strokeWidth={3}
            aria-hidden="true"
          />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 opacity-0 animate-rise motion-reduce:opacity-100">
          {title}
        </h2>
        <p className="text-sm text-white/85 max-w-[260px] opacity-0 animate-rise-delayed motion-reduce:opacity-100">
          {subtitle}
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes pingSlow {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          80%,
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
        @keyframes checkPop {
          0% {
            transform: scale(0);
          }
          60% {
            transform: scale(1.1);
          }
          80% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes checkIcon {
          0%,
          30% {
            transform: scale(0);
            opacity: 0;
          }
          60% {
            transform: scale(1.2);
            opacity: 1;
          }
          80% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes rise {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes sparkle1 {
          0%,
          100% {
            transform: scale(0.8) rotate(0deg);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.2) rotate(20deg);
            opacity: 1;
          }
        }
        @keyframes sparkle2 {
          0%,
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.3) rotate(-15deg);
            opacity: 0.9;
          }
        }
        @keyframes sparkle3 {
          0%,
          100% {
            transform: scale(0.9) rotate(0deg);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.15) rotate(25deg);
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fadeIn 280ms ease-out forwards;
        }
        .animate-ping-slow {
          animation: pingSlow 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-check-pop {
          animation: checkPop 540ms cubic-bezier(0.34, 1.56, 0.64, 1) 80ms forwards;
        }
        .animate-check-icon {
          animation: checkIcon 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 260ms forwards;
        }
        .animate-rise {
          animation: rise 420ms cubic-bezier(0.16, 1, 0.3, 1) 500ms forwards;
        }
        .animate-rise-delayed {
          animation: rise 420ms cubic-bezier(0.16, 1, 0.3, 1) 680ms forwards;
        }
        .animate-sparkle-1 {
          animation: sparkle1 1.6s ease-in-out 800ms infinite;
        }
        .animate-sparkle-2 {
          animation: sparkle2 1.8s ease-in-out 950ms infinite;
        }
        .animate-sparkle-3 {
          animation: sparkle3 1.7s ease-in-out 880ms infinite;
        }
      `}</style>
    </div>
  );
}
