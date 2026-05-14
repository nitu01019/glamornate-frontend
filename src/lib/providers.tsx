'use client';

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactNode, useState, useEffect, useCallback, createContext, useContext } from 'react';
import { AuthProvider } from './auth-provider';
import { LocationProvider } from './location-provider';
import { initializeFirebaseApp } from './firebase-config';
import { initAppCheck, startAppCheckHeartbeat } from './app-check';
import { logger } from './logger';
import { setIdTokenProvider } from './api-client';
import { authService } from './firebase-client';
import { parseError, getUserFriendlyMessage, isAuthError, AppError } from './error-handler';
import { getPlatformPersister, buster } from './query-persister';
import {
  ToastProvider as RadixToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from '@/components/ui/toast';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// =============================================================================
// Toast System
// =============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Convenience toast methods
export function useToastActions() {
  const { addToast } = useToast();

  return {
    success: (title: string, description?: string) =>
      addToast({ type: 'success', title, description }),
    error: (title: string, description?: string) => addToast({ type: 'error', title, description }),
    warning: (title: string, description?: string) =>
      addToast({ type: 'warning', title, description }),
    info: (title: string, description?: string) => addToast({ type: 'info', title, description }),
  };
}

// =============================================================================
// Toast Provider Implementation
// =============================================================================

interface ToastProviderProps {
  children: ReactNode;
}

function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 4000);

    setToasts((prev) => [...prev, { ...toast, id, duration }]);

    // Auto-remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const toastIcons: Record<ToastType, typeof AlertCircle> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const toastVariants: Record<ToastType, 'default' | 'destructive' | 'success' | 'amber'> = {
    success: 'success',
    error: 'destructive',
    warning: 'amber',
    info: 'default',
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      <RadixToastProvider swipeDirection="right">
        {children}

        {toasts.map((toast) => {
          const Icon = toastIcons[toast.type];
          return (
            <Toast
              key={toast.id}
              variant={toastVariants[toast.type]}
              duration={toast.duration}
              onOpenChange={(open) => {
                if (!open) removeToast(toast.id);
              }}
            >
              <div className="flex gap-3">
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <ToastTitle>{toast.title}</ToastTitle>
                  {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
                </div>
              </div>
              <ToastClose />
            </Toast>
          );
        })}

        <ToastViewport />
      </RadixToastProvider>
    </ToastContext.Provider>
  );
}

// =============================================================================
// Query Client with Error Handling
// =============================================================================

function createQueryClient(showErrorToast: (error: AppError) => void): QueryClient {
  const queryErrorLogger = logger.child({ component: 'ReactQuery' });

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const appError = parseError(error);

        queryErrorLogger.error('Query failed', appError, {
          queryKey: query.queryKey,
          state: query.state.status,
        });

        // Don't show toast for auth errors (handled elsewhere) or background refetches
        if (!isAuthError(error) && query.state.data !== undefined) {
          // Only show toast for errors on queries that previously had data (refetch failures)
          showErrorToast(appError);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        const appError = parseError(error);

        queryErrorLogger.error('Mutation failed', appError, {
          mutationKey: mutation.options.mutationKey,
        });

        // β8 fix (2026-05-12): mirror queryCache.onError's auth guard at L169.
        // Auth errors are surfaced by AuthProvider / token-revoke seam (banner
        // on /auth/login). Toasting them here doubles the messaging and can
        // toast over the login page during a mid-flow session expiry.
        if (!mutation.meta?.skipErrorToast && !isAuthError(error)) {
          showErrorToast(appError);
        }
      },
    }),
    defaultOptions: {
      queries: {
        // 5 minutes: reasonable staleTime for non-critical data.
        // Availability-sensitive queries should override staleTime to 0.
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
        // Don't retry on 4xx client errors; retry up to 2 times for other failures.
        retry: (failureCount, error) => {
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status: number }).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        // Disabled globally. Availability-sensitive queries (e.g. booking slots)
        // should override this with refetchOnWindowFocus: true at the call site.
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
      },
      mutations: {
        retry: (failureCount, error) => {
          // Only retry network errors for mutations, max 2 times
          const appError = parseError(error);
          return appError.isRetryable && failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        onError: (error) => {
          queryErrorLogger.error('Mutation failed', error);
        },
      },
    },
  });
}

// =============================================================================
// Props & Types
// =============================================================================

interface ProvidersProps {
  children: ReactNode;
}

// =============================================================================
// Inner Provider (has access to toast context)
// =============================================================================

function InnerProviders({ children }: ProvidersProps) {
  const { addToast } = useToast();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `_firebaseReady` setter is used to unblock App Check init; the boolean is not read by this component, but the state ref forces a rerender downstream
  const [_firebaseReady, setFirebaseReady] = useState(false);

  const showErrorToast = useCallback(
    (error: AppError) => {
      const message = getUserFriendlyMessage(error);
      addToast({
        type: 'error',
        title: 'Error',
        description: message,
      });
    },
    [addToast],
  );

  const [queryClient] = useState(() => createQueryClient(showErrorToast));
  const [persister] = useState(() => getPlatformPersister());

  // Initialize Firebase on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeFirebaseApp()
        .then(() => {
          setFirebaseReady(true);
          logger.info('Firebase initialized successfully', { component: 'Providers' });

          // A1.1 — Wire the api-client's id-token provider to authService now
          // that Firebase Auth is initialised. Without this, every authenticated
          // request from `apiClient` is missing its `Authorization: Bearer …`
          // header, causing silent 401s. The closure captures the live
          // `authService.getIdToken` so it always reads `currentUser` at call
          // time and supports forceRefresh on 401+token-expired retries.
          setIdTokenProvider((forceRefresh) => authService.getIdToken(forceRefresh));

          // M-APPCHECK-WIRE: Initialize App Check AFTER Firebase is ready.
          //   - Web: ReCaptcha v3 provider (see src/lib/app-check.ts).
          //   - Native (Capacitor Android/iOS): CustomProvider that bridges to
          //     the Capacitor Firebase App Check plugin, which in turn uses Play
          //     Integrity (Android) or App Attest/DeviceCheck (iOS). Both paths
          //     are handled inside initAppCheck() itself.
          //   - Silent fallback: errors are logged inside initAppCheck — the
          //     app must continue because App Check is defense-in-depth and the
          //     backend independently rejects un-tokened requests.
          try {
            initAppCheck();
            // Phase 8 (Booking Flow Fix v3.1, 2026-05-02): proactively
            // refresh the App Check token every 45 minutes while the tab
            // is visible. Pre-empts the 60-minute expiry so a long-idle
            // session doesn't surface a permission-denied on the next
            // Firestore read.
            startAppCheckHeartbeat();
          } catch (appCheckError) {
            logger.error('App Check init threw — continuing without token', appCheckError, {
              component: 'Providers',
            });
          }
        })
        .catch((err) => {
          logger.error('Firebase initialization error', err, { component: 'Providers' });
          // Still set ready to true so app can load
          setFirebaseReady(true);
        });

      // Initialize Capacitor plugins on native platforms
      import('@/lib/capacitor-init')
        .then(({ initializeCapacitorPlugins }) => initializeCapacitorPlugins())
        .catch(() => {
          // Not running in Capacitor — silently ignore
        });
    }
  }, []);

  // Render the app immediately — don't block on Firebase initialization.
  // Auth and Firestore hooks already guard with isFirebaseConfigured().
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster,
        maxAge: 1000 * 60 * 60 * 24, // 24h
        dehydrateOptions: {
          // Only dehydrate successful queries, and never persist user-scoped
          // data (auth, bookings, notifications) — those are re-fetched on
          // load for freshness and to avoid leaking into other accounts.
          shouldDehydrateQuery: (query) => {
            if (query.state.status !== 'success') return false;
            const root = String(query.queryKey[0] ?? '');
            return !['user', 'bookings', 'notifications'].includes(root);
          },
        },
      }}
    >
      <AuthProvider>
        <LocationProvider>{children}</LocationProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

// =============================================================================
// Main Providers Export
// =============================================================================

export function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider>
      <InnerProviders>{children}</InnerProviders>
    </ToastProvider>
  );
}

// =============================================================================
// Type augmentation for React Query
// =============================================================================

// Extend React Query's MutationMeta type
// Note: If duplicate declaration errors occur, ensure this is the only place
// where MutationMeta is augmented in the project
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Skip showing error toast for this mutation */
      skipErrorToast?: boolean;
    };
  }
}
