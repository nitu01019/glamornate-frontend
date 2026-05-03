'use client';

/**
 * Signup availability — Phase 7 frontend hook (industrial-grade rewrite).
 *
 * Probes the backend `checkSignupAvailability` callable to surface a
 * live "available / taken" pill next to the email and phone fields on
 * the signup form. Supports two trigger modes:
 *
 *   - 'onChange': fires after a 300 ms debounce on every keystroke.
 *   - 'onBlur': only fires when the caller invokes `triggerCheck()`.
 *   - 'both' (default): auto-fires on debounced onChange AND accepts
 *     an immediate `triggerCheck()` call on blur.
 *
 * Error handling is intentionally silent: App Check failures and network
 * errors fall through to `'idle'` rather than `'error'`. The duplicate-email
 * error is surfaced at `authService.signUp()` time by Firebase Auth itself,
 * so the availability check is purely advisory UX polish.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CheckSignupAvailabilityRequest,
  CheckSignupAvailabilityResponse,
} from '@/lib/contracts';
import { firebaseClientWrapper } from '@/lib/firebase-client-wrapper';
import { getAppCheckToken } from '@/lib/app-check';
import { useDebounceValue } from './useDebounceValue';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @deprecated 'error' will never be set by this hook (silent-fail pattern).
 * Kept in the union for backwards compatibility with callers that type-guard
 * against it. It is safe to remove from call-site switch/case statements.
 */
export type SignupAvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export interface SignupAvailabilityResult {
  status: SignupAvailabilityStatus;
  /** The email / phone value that the last successful check resolved against. */
  lastCheckedEmail: string;
  /**
   * Immediately fire an availability check for the current `value` without
   * waiting for the debounce. Designed for `onBlur` handlers. Cancels any
   * pending debounced request and resets the retry counter.
   */
  triggerCheck: () => void;
}

export interface UseSignupAvailabilityOptions {
  /**
   * Controls when automatic checks fire.
   *
   * - 'onChange': debounced 300 ms after each keystroke.
   * - 'onBlur': no auto check; only fires when `triggerCheck()` is called.
   * - 'both' (default): debounced onChange + immediate `triggerCheck()`.
   */
  trigger?: 'onChange' | 'onBlur' | 'both';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Match the backend contracts schema: optional leading `+`, country code 1-9, 6-14 digits.
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;
const APP_CHECK_TIMEOUT_MS = 2000;
const RETRY_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pre-validate locally so we never call the backend with garbage. Mirrors
 * (a slightly looser version of) the contracts schema — the server is the
 * authoritative validator.
 */
function looksValid(field: 'email' | 'phone', value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (field === 'email') return EMAIL_RE.test(trimmed);
  return PHONE_RE.test(trimmed.replace(/\s+/g, ''));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useSignupAvailability` — probes the `checkSignupAvailability` callable
 * for a single field and returns a stable `status` for inline rendering.
 *
 * @param field      Which field to probe — `'email'` or `'phone'`.
 * @param value      Raw input value (will be trimmed/lowercased internally).
 * @param options    `{ trigger?: 'onChange' | 'onBlur' | 'both' }` (default `'both'`).
 *
 * @example
 *   const { status, triggerCheck } = useSignupAvailability('email', email, { trigger: 'both' });
 *   // onBlur={() => triggerCheck()}
 *   // status: 'idle' | 'checking' | 'available' | 'taken'
 */
export function useSignupAvailability(
  field: 'email' | 'phone',
  value: string,
  options?: UseSignupAvailabilityOptions,
): SignupAvailabilityResult {
  const trigger = options?.trigger ?? 'both';

  const debounced = useDebounceValue(value, 300);
  const [status, setStatus] = useState<SignupAvailabilityStatus>('idle');
  const [lastCheckedEmail, setLastCheckedEmail] = useState('');

  // Stale-response guard: bump on every new request; only the latest wins.
  const requestTokenRef = useRef(0);
  // Per-value attempt counter for one-shot retry logic.
  const attemptRef = useRef(0);
  // Tracks whether an immediate (blur) check is pending to suppress duplicate
  // debounced checks.
  const immediateCheckPendingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Core async check (shared by debounced onChange and immediate triggerCheck)
  // ---------------------------------------------------------------------------

  const runCheck = useCallback(
    async (raw: string, myToken: number) => {
      const trimmed = raw.trim();

      if (trimmed.length === 0 || !looksValid(field, trimmed)) {
        if (myToken === requestTokenRef.current) setStatus('idle');
        return;
      }

      if (myToken === requestTokenRef.current) setStatus('checking');

      // Wait for App Check token with a 2-second ceiling.
      // `getAppCheckToken` already swallows internal errors and returns null.
      const appCheckToken = await Promise.race([
        getAppCheckToken(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), APP_CHECK_TIMEOUT_MS)),
      ]);

      if (appCheckToken === null) {
        // App Check not ready — pass through silently. The next keystroke or
        // blur will retry once App Check has warmed up.
        if (myToken === requestTokenRef.current) setStatus('idle');
        return;
      }

      const payload: CheckSignupAvailabilityRequest =
        field === 'email'
          ? { email: trimmed.toLowerCase() }
          : { phone: trimmed.replace(/\s+/g, '') };

      try {
        const response = await firebaseClientWrapper.callFunction<
          CheckSignupAvailabilityRequest,
          CheckSignupAvailabilityResponse
        >('checkSignupAvailability', payload);

        if (myToken !== requestTokenRef.current) return;

        const fieldResult = field === 'email' ? response.email : response.phone;
        if (!fieldResult) {
          // Backend returned a null slot (rate_limited or unknown) — silent idle.
          setStatus('idle');
          return;
        }

        setLastCheckedEmail(trimmed);
        setStatus(fieldResult.available ? 'available' : 'taken');
        attemptRef.current = 0;
      } catch (err) {
        if (myToken !== requestTokenRef.current) return;

        logger.warn(
          'checkSignupAvailability failed',
          { component: 'useSignupAvailability', action: field },
          { error: err instanceof Error ? err.message : String(err) },
        );

        // One-shot retry: schedule a second attempt after RETRY_DELAY_MS.
        if (attemptRef.current === 0) {
          attemptRef.current = 1;
          setTimeout(() => {
            // Only retry if the value hasn't changed in the meantime.
            const retryToken = ++requestTokenRef.current;
            void runCheck(raw, retryToken);
          }, RETRY_DELAY_MS);
        } else {
          // Second failure — silent idle (never surface 'error').
          attemptRef.current = 0;
          setStatus('idle');
        }
      }
    },
    [field],
  );

  // ---------------------------------------------------------------------------
  // Debounced onChange effect (active when trigger !== 'onBlur')
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (trigger === 'onBlur') return;
    if (immediateCheckPendingRef.current) return;

    const myToken = ++requestTokenRef.current;
    attemptRef.current = 0;
    void runCheck(debounced, myToken);
  }, [debounced, trigger, runCheck]);

  // ---------------------------------------------------------------------------
  // Public triggerCheck — immediate (no debounce), for onBlur handlers
  // ---------------------------------------------------------------------------

  const triggerCheck = useCallback(() => {
    // Cancel any pending debounced check by bumping the token before we start.
    immediateCheckPendingRef.current = true;
    const myToken = ++requestTokenRef.current;
    attemptRef.current = 0;

    // Clear the flag after a brief moment so the next debounced event
    // (from a subsequent onChange) is not incorrectly suppressed.
    setTimeout(() => {
      immediateCheckPendingRef.current = false;
    }, 350);

    void runCheck(value, myToken);
  }, [value, runCheck]);

  return { status, lastCheckedEmail, triggerCheck };
}
