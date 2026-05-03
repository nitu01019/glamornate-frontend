'use client';

/**
 * Shared client-side error boundary.
 *
 * Phase 4.5 (Booking Flow Fix v3.1, 2026-05-02, Patch DR-10): used inside
 * route segments that need a finer-grained boundary than Next.js's
 * `error.tsx`, e.g. wrapping a third-party widget. The default fallback
 * mirrors the Next.js boundary visually (same copy, same buttons) so the
 * UX is consistent regardless of which boundary fires.
 *
 * Errors are forwarded to Sentry through @sentry/nextjs (which is already
 * wired up in the app), with the React component stack included.
 */
import * as React from 'react';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';
import { SUBMIT_GENERIC_ERROR, SUBMIT_RETRY } from '@/lib/booking/copy';

export interface ErrorBoundaryProps {
  /** Custom fallback. Receives the caught error + a `reset()` callback. */
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  /** Optional side-effect callback (Sentry forwarding fires regardless). */
  onError?(error: Error, info: { componentStack: string }): void;
  /** Override the retry button label. */
  retryLabel?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string | null }): void {
    const componentStack = info.componentStack ?? '';
    Sentry.captureException(error, {
      contexts: { react: { componentStack } },
    });
    logger.error('ErrorBoundary caught', error, { component: 'ErrorBoundary' });
    this.props.onError?.(error, { componentStack });
  }

  reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (typeof this.props.fallback === 'function') {
      return this.props.fallback(error, this.reset);
    }
    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-base font-semibold text-red-900">{SUBMIT_GENERIC_ERROR}</h2>
        <button
          type="button"
          onClick={this.reset}
          className="mt-3 inline-flex items-center justify-center rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          {this.props.retryLabel ?? SUBMIT_RETRY}
        </button>
      </div>
    );
  }
}
