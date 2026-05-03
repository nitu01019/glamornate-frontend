'use client';

import { ReactNode } from 'react';
import { AlertCircle, WifiOff, ShieldX, ServerCrash, FileQuestion, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type ErrorStateVariant = 'inline' | 'fullPage' | 'card';

export type ErrorType = 'generic' | 'network' | 'auth' | 'server' | 'notFound' | 'validation';

export interface ErrorStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message/description */
  message?: string;
  /** Error type - determines icon and default message */
  type?: ErrorType;
  /** Custom icon */
  icon?: ReactNode;
  /** Primary action button */
  action?: ErrorStateAction;
  /** Secondary action button */
  secondaryAction?: ErrorStateAction;
  /** Display variant */
  variant?: ErrorStateVariant;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show retry button (uses action or built-in) */
  showRetry?: boolean;
  /** Retry callback (used when showRetry is true) */
  onRetry?: () => void;
}

// =============================================================================
// Error Type Configs
// =============================================================================

const errorTypeConfig: Record<ErrorType, { icon: typeof AlertCircle; defaultTitle: string; defaultMessage: string }> = {
  generic: {
    icon: AlertCircle,
    defaultTitle: 'Something went wrong',
    defaultMessage: 'An unexpected error occurred. Please try again.',
  },
  network: {
    icon: WifiOff,
    defaultTitle: 'Connection error',
    defaultMessage: 'Unable to connect. Please check your internet connection.',
  },
  auth: {
    icon: ShieldX,
    defaultTitle: 'Access denied',
    defaultMessage: 'You don\'t have permission to access this resource.',
  },
  server: {
    icon: ServerCrash,
    defaultTitle: 'Server error',
    defaultMessage: 'Something went wrong on our end. Please try again later.',
  },
  notFound: {
    icon: FileQuestion,
    defaultTitle: 'Not found',
    defaultMessage: 'The resource you\'re looking for doesn\'t exist.',
  },
  validation: {
    icon: AlertTriangle,
    defaultTitle: 'Invalid input',
    defaultMessage: 'Please check your input and try again.',
  },
};

// =============================================================================
// Component
// =============================================================================

export function ErrorState({
  title,
  message,
  type = 'generic',
  icon,
  action,
  secondaryAction,
  variant = 'card',
  className,
  showRetry = false,
  onRetry,
}: ErrorStateProps) {
  const config = errorTypeConfig[type];
  const IconComponent = config.icon;

  const displayTitle = title ?? config.defaultTitle;
  const displayMessage = message ?? config.defaultMessage;

  // Build actions array
  const actions: ErrorStateAction[] = [];
  
  if (showRetry && onRetry) {
    actions.push({
      label: 'Try Again',
      onClick: onRetry,
      variant: 'primary',
    });
  }
  
  if (action) {
    actions.push(action);
  }
  
  if (secondaryAction) {
    actions.push(secondaryAction);
  }

  // Render based on variant
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg bg-brand-maroon-50 border border-brand-maroon-100',
          className
        )}
      >
        <div className="shrink-0">
          {icon ?? <IconComponent className="w-5 h-5 text-brand-maroon-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-brand-maroon-800">{displayTitle}</p>
          <p className="text-sm text-brand-maroon-600 truncate">{displayMessage}</p>
        </div>
        {actions.length > 0 && (
          <div className="shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={actions[0].onClick}
              className="text-brand-maroon-600 hover:text-brand-maroon-700 hover:bg-brand-maroon-100"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              {actions[0].label}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'fullPage') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center min-h-[60vh] p-8 text-center',
          className
        )}
      >
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-brand-maroon-100/50 to-brand-gold-100/50 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-maroon-100 to-brand-maroon-50 mb-6">
            {icon ?? <IconComponent className="w-10 h-10 text-brand-maroon-500" />}
          </div>

          {/* Text */}
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            {displayTitle}
          </h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            {displayMessage}
          </p>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {actions.map((act, index) => (
                <Button
                  key={index}
                  onClick={act.onClick}
                  variant={act.variant === 'secondary' || index > 0 ? 'outline' : 'default'}
                  className={cn(
                    index === 0 && act.variant !== 'secondary' &&
                    'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 hover:from-brand-maroon-600 hover:to-brand-gold-600 text-white shadow-lg shadow-brand-maroon-200'
                  )}
                >
                  {index === 0 && act.variant !== 'secondary' && (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {act.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Card variant (default)
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 rounded-xl bg-white border border-slate-100 shadow-sm text-center',
        className
      )}
    >
      {/* Icon */}
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-maroon-50 mb-4">
        {icon ?? <IconComponent className="w-7 h-7 text-brand-maroon-500" />}
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {displayTitle}
      </h3>
      <p className="text-sm text-slate-500 mb-6 max-w-xs">
        {displayMessage}
      </p>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions.map((act, index) => (
            <Button
              key={index}
              size="sm"
              onClick={act.onClick}
              variant={act.variant === 'secondary' || index > 0 ? 'outline' : 'default'}
              className={cn(
                index === 0 && act.variant !== 'secondary' &&
                'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 hover:from-brand-maroon-600 hover:to-brand-gold-600 text-white'
              )}
            >
              {index === 0 && showRetry && <RefreshCw className="w-4 h-4 mr-2" />}
              {act.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Preset Error States
// =============================================================================

export function NetworkError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="network" {...props} />;
}

export function AuthError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="auth" {...props} />;
}

export function ServerError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="server" {...props} />;
}

export function NotFoundError(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="notFound" {...props} />;
}

export function ValidationErrorState(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState type="validation" {...props} />;
}
