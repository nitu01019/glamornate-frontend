'use client';

import { Component, ReactNode, ErrorInfo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { logger } from '@/lib/logger';
import { parseError, getUserFriendlyMessage, AppError } from '@/lib/error-handler';

// =============================================================================
// Types
// =============================================================================

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI to render on error */
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode);
  /** Called when an error is caught */
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  /** Whether to show retry button (default: true) */
  showRetry?: boolean;
  /** Whether to show go home button (default: true) */
  showHome?: boolean;
  /** Custom component name for logging */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: AppError;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

export interface ErrorFallbackProps {
  error: AppError;
  errorInfo?: ErrorInfo;
  retry: () => void;
  retryCount: number;
}

// =============================================================================
// Error Boundary Component
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private boundaryLogger = logger.child({ component: 'ErrorBoundary' });

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error: parseError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = parseError(error);

    // Log the error
    this.boundaryLogger.error('Uncaught error in component tree', appError, {
      componentStack: errorInfo.componentStack,
      componentName: this.props.componentName,
      retryCount: this.state.retryCount,
    });

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler if provided
    this.props.onError?.(appError, errorInfo);
  }

  private handleRetry = () => {
    this.boundaryLogger.info('User attempting retry', {
      retryCount: this.state.retryCount + 1,
    });

    this.setState((prevState) => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1,
    }));
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { children, fallback, showRetry = true, showHome = true } = this.props;

    if (hasError && error) {
      // Custom fallback renderer
      if (typeof fallback === 'function') {
        return fallback({
          error,
          errorInfo,
          retry: this.handleRetry,
          retryCount,
        });
      }

      // Custom fallback element
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          retry={this.handleRetry}
          retryCount={retryCount}
          showRetry={showRetry}
          showHome={showHome}
        />
      );
    }

    return children;
  }
}

// =============================================================================
// Default Error Fallback UI
// =============================================================================

interface DefaultErrorFallbackProps extends ErrorFallbackProps {
  showRetry: boolean;
  showHome: boolean;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  retry,
  retryCount,
  showRetry,
  showHome,
}: DefaultErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const userMessage = getUserFriendlyMessage(error);
  const isMaxRetries = retryCount >= 3;

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="w-full max-w-md">
        {/* Error Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-brand-maroon-100 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-1">Something went wrong</h2>
            <p className="text-brand-maroon-100 text-sm">We encountered an unexpected error</p>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <p className="text-slate-600 text-center mb-6">{userMessage}</p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {showRetry && (
                <Button
                  onClick={retry}
                  disabled={isMaxRetries}
                  className="flex-1 bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 hover:from-brand-maroon-600 hover:to-brand-gold-600 text-white shadow-lg shadow-brand-maroon-200 disabled:opacity-50 disabled:shadow-none"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isMaxRetries ? '' : ''}`} />
                  {isMaxRetries ? 'Max Retries Reached' : 'Try Again'}
                </Button>
              )}
              {showHome && (
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = '/')}
                  className="flex-1 border-slate-200 hover:bg-slate-50"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              )}
            </div>

            {/* Retry count indicator */}
            {retryCount > 0 && (
              <p className="text-center text-xs text-slate-400 mt-4">
                Retry attempts: {retryCount}/3
              </p>
            )}
          </div>

          {/* Technical Details (Collapsible) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="border-t border-slate-100">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full px-6 py-3 flex items-center justify-between text-sm text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center">
                  <Bug className="w-4 h-4 mr-2" />
                  Technical Details
                </span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showDetails && (
                <div className="px-6 pb-6 space-y-4">
                  {/* Error Info */}
                  <div className="bg-slate-50 rounded-lg p-4 overflow-auto">
                    <p className="text-xs font-mono text-slate-600 mb-2">
                      <span className="text-brand-maroon-500 font-semibold">{error.name}:</span>{' '}
                      {error.message}
                    </p>
                    <p className="text-xs font-mono text-slate-400">
                      Code: {error.code} | Status: {error.statusCode}
                    </p>
                  </div>

                  {/* Stack Trace */}
                  {error.stack && (
                    <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-48">
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </div>
                  )}

                  {/* Component Stack */}
                  {errorInfo?.componentStack && (
                    <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-32">
                      <p className="text-xs font-semibold text-slate-400 mb-2">Component Stack:</p>
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Support link */}
        <p className="text-center text-xs text-slate-400 mt-4">
          If this problem persists, please{' '}
          <a
            href="mailto:support@glamornate.com"
            className="text-brand-maroon-500 hover:text-brand-maroon-600 underline"
          >
            contact support
          </a>
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Utility HOC
// =============================================================================

/**
 * Higher-order component to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>,
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary componentName={displayName} {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}
