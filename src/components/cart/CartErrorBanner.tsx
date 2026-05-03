'use client';

/**
 * Inline banner surfacing actionable cart errors.
 *
 * Round 5 C-4: replaces the legacy red toast with a prominent, in-flow banner
 * that sits directly above `CartSummary`. Toasts were getting missed on slow
 * connections (the user's #1 complaint: "network error" with no way to recover).
 *
 * The banner is purely presentational — the mapping logic lives in
 * `src/app/cart/cart-error-mapping.ts`. This component accepts a
 * `CartErrorState` descriptor and renders one of six visual variants.
 */

import Link from 'next/link';
import { AlertCircle, Lock, MapPin, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import type { CartErrorCta, CartErrorState, CartErrorVariant } from '@/app/cart/cart-error-mapping';

interface CartErrorBannerProps {
  state: CartErrorState;
  onRetry?: () => void;
  onRefresh?: () => void;
  onReport?: () => void;
  onDismiss?: () => void;
  /** When true, the retry/refresh buttons are disabled (e.g. during 429 cooldown). */
  disabled?: boolean;
}

interface VariantStyle {
  icon: typeof AlertCircle;
  container: string;
  iconWrap: string;
  title: string;
}

const VARIANT_STYLES: Record<CartErrorVariant, VariantStyle> = {
  'auth-required': {
    icon: Lock,
    container: 'bg-amber-50 border-amber-200',
    iconWrap: 'bg-amber-100 text-amber-700',
    title: 'text-amber-900',
  },
  'items-unavailable': {
    icon: AlertCircle,
    container: 'bg-orange-50 border-orange-200',
    iconWrap: 'bg-orange-100 text-orange-700',
    title: 'text-orange-900',
  },
  'address-required': {
    icon: MapPin,
    container: 'bg-blue-50 border-blue-200',
    iconWrap: 'bg-blue-100 text-blue-700',
    title: 'text-blue-900',
  },
  'rate-limited': {
    icon: ShieldAlert,
    container: 'bg-yellow-50 border-yellow-200',
    iconWrap: 'bg-yellow-100 text-yellow-700',
    title: 'text-yellow-900',
  },
  'connection-issue': {
    icon: WifiOff,
    container: 'bg-red-50 border-red-200',
    iconWrap: 'bg-red-100 text-red-700',
    title: 'text-red-900',
  },
  unknown: {
    icon: AlertCircle,
    container: 'bg-gray-50 border-gray-200',
    iconWrap: 'bg-gray-100 text-gray-700',
    title: 'text-gray-900',
  },
};

function CtaButton({
  cta,
  onRetry,
  onRefresh,
  onReport,
  disabled,
  prominent,
}: {
  cta: CartErrorCta;
  onRetry?: () => void;
  onRefresh?: () => void;
  onReport?: () => void;
  disabled?: boolean;
  prominent: boolean;
}) {
  const baseClasses = prominent
    ? 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-maroon-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-maroon-600 active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
    : 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';

  if (cta.href) {
    return (
      <Link
        href={cta.href}
        className={baseClasses}
        data-testid={`cart-error-cta-${cta.action ?? 'link'}`}
      >
        {cta.label}
      </Link>
    );
  }

  const onClick = (() => {
    if (cta.action === 'retry') return onRetry;
    if (cta.action === 'refresh') return onRefresh;
    if (cta.action === 'report') return onReport;
    return undefined;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={baseClasses}
      data-testid={`cart-error-cta-${cta.action ?? 'button'}`}
    >
      {cta.action === 'retry' || cta.action === 'refresh' ? (
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      ) : null}
      {cta.label}
    </button>
  );
}

export default function CartErrorBanner({
  state,
  onRetry,
  onRefresh,
  onReport,
  onDismiss,
  disabled = false,
}: CartErrorBannerProps) {
  const style = VARIANT_STYLES[state.variant];
  const Icon = style.icon;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="cart-error-banner"
      data-variant={state.variant}
      className={`mx-4 mb-3 rounded-xl border p-4 shadow-sm ${style.container}`}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${style.iconWrap}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`text-sm font-semibold ${style.title}`}>{state.title}</h3>
          <p className="mt-0.5 text-sm text-gray-700">{state.message}</p>
          {(state.primaryCta || state.secondaryCta) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {state.primaryCta && (
                <CtaButton
                  cta={state.primaryCta}
                  onRetry={onRetry}
                  onRefresh={onRefresh}
                  onReport={onReport}
                  disabled={disabled}
                  prominent
                />
              )}
              {state.secondaryCta && (
                <CtaButton
                  cta={state.secondaryCta}
                  onRetry={onRetry}
                  onRefresh={onRefresh}
                  onReport={onReport}
                  disabled={disabled}
                  prominent={false}
                />
              )}
            </div>
          )}
          {state.requestId && (
            <p className="mt-2 text-[11px] font-mono text-gray-400">Ref: {state.requestId}</p>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex-none rounded-md p-1 text-gray-400 transition-colors hover:bg-white/60 hover:text-gray-600"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
