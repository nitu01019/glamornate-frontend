import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import * as Sentry from '@sentry/nextjs';
import { setOnTokenRevoked } from '@/auth/client';
import type { logger } from '@/lib/logger';

type Logger = ReturnType<typeof logger.child>;

export interface TokenRevokeDeps {
  signOutRef: MutableRefObject<() => Promise<void>>;
  log: Logger;
}

// Phase 9 (Auth Bridge Fix, 2026-05-08): when the backend rejects with
// `token-revoked` (checkRevoked: true), force-refreshing the token does
// NOT help — the session is dead. Wire a callback into api-client so it
// can trigger a full sign-out + redirect when this happens.
//
// A-6-13: static import (registered at module-load) avoids the dynamic-
// import chunk-load failure mode, which surfaced as an unhandled rejection
// when the api-client chunk failed to fetch on flaky networks. Wrap the
// registration itself in try/catch so a thrown setter cannot break auth.
export function useTokenRevokeRegistration(deps: TokenRevokeDeps): void {
  const { signOutRef, log } = deps;
  useEffect(() => {
    try {
      setOnTokenRevoked(() => {
        log.warn('Token revoked by backend — forcing full sign-out');
        void signOutRef
          .current()
          .catch(() => {
            // signOut already hardens against partial failures; ignore here.
          })
          .finally(() => {
            // 2026-05-11 (Forge-D2 / F17): after sweep, hard-navigate to
            // login with a `reason` query so the user sees a banner. Without
            // this, an authenticated route may briefly render with user=null
            // until its own guard re-renders, and the user has no idea why
            // their session ended.
            if (typeof window !== 'undefined') {
              window.location.assign('/auth/login?reason=session_expired');
            }
          });
      });
    } catch (err) {
      log.error('Failed to register token-revoked handler', err);
      Sentry.captureException(err, {
        tags: { source: 'auth-provider', phase: 'token-revoked-registration' },
      });
    }
    return () => {
      try {
        setOnTokenRevoked(null);
      } catch {
        // Defensive: cleanup must never throw during unmount.
      }
    };
  }, [signOutRef, log]);
}
