'use client';

/**
 * ChangePasswordSheet
 * -------------------
 * Bottom-sheet flow that lets a signed-in user rotate their password.
 *
 * Flow:
 *   1. Enter current password.
 *   2. Enter new password + confirmation, with a live strength meter
 *      (length >= 8 and at least two of {lower, upper, digit, symbol}).
 *   3. Submit → reauthenticate → updatePassword → success toast → close.
 *
 * Form state is managed by `react-hook-form` with a `zodResolver` over
 * `changePasswordSchema` (see `@/lib/schemas/change-password`). The live
 * strength meter continues to drive UI affordances (blocking disabled
 * submit, painting colored pips) by watching the `newPassword` field
 * through `useWatch`. Password visibility toggles are **intentionally**
 * outside the form state — they are UI-only and should not survive
 * form resets.
 *
 * Error handling: every Firebase Auth error code is routed through
 * `mapAuthError` so the UI never shows raw `.message` or codes. When
 * Firebase returns `auth/requires-recent-login` we keep the sheet open
 * and refocus the current-password input so the user can retry.
 *
 * Accessibility:
 *   - Radix Dialog handles focus trap + Escape close.
 *   - `prefers-reduced-motion` honored via conditional Tailwind classes.
 *   - Labels are associated via htmlFor/id so screen readers announce
 *     field-level errors.
 *   - Submit button exposes an `aria-busy` state during the async call.
 *
 * This component contains wiring only — the visual polish is deferred to
 * Alpha's cross-review per PHASE_3.md §4.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Eye, EyeOff, Loader2, ShieldCheck, X } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '@/lib/auth-provider';
import { useToastActions } from '@/lib/providers';
import { mapAuthError, type MappedAuthError } from '@/lib/account/auth-error-map';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/lib/schemas/change-password';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'ChangePasswordSheet' });

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface ChangePasswordSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

export interface PasswordStrength {
  readonly score: 0 | 1 | 2 | 3 | 4;
  readonly label: 'Too weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  readonly rules: {
    readonly length: boolean;
    readonly lowerAndUpper: boolean;
    readonly digit: boolean;
    readonly symbol: boolean;
  };
  readonly meetsMinimum: boolean;
}

export function scorePassword(value: string): PasswordStrength {
  const rules = {
    length: value.length >= 8,
    lowerAndUpper: /[a-z]/.test(value) && /[A-Z]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
  const met = Object.values(rules).filter(Boolean).length;
  const meetsMinimum =
    rules.length && [rules.lowerAndUpper, rules.digit, rules.symbol].filter(Boolean).length >= 1;

  const score = (meetsMinimum ? Math.max(1, met) : Math.min(1, met)) as 0 | 1 | 2 | 3 | 4;
  const labels: PasswordStrength['label'][] = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return {
    score,
    label: labels[score],
    rules,
    meetsMinimum,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Status = 'idle' | 'submitting';

export function ChangePasswordSheet({ open, onClose }: ChangePasswordSheetProps): JSX.Element {
  const { firebaseUser } = useAuth();
  const toast = useToastActions();

  // UI-only toggles (deliberately NOT part of form state so resets never
  // flip the eye icon unexpectedly).
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<MappedAuthError | null>(null);

  const currentInputRef = useRef<HTMLInputElement | null>(null);
  const newInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
    mode: 'onBlur',
  });

  const { register, handleSubmit, reset, setFocus, setValue, watch, formState } = form;
  const { errors } = formState;

  // Live watch for the strength meter + inline confirm-mismatch hint +
  // reactive `canSubmit` gate. `form.watch()` subscribes this component
  // to all field updates so every `onChange` triggers a re-render in the
  // same commit — matching the prior controlled-`useState` UX exactly.
  const [currentPassword, newPassword, confirmNewPassword] = watch([
    'currentPassword',
    'newPassword',
    'confirmNewPassword',
  ]);

  const strength = useMemo(() => scorePassword(newPassword ?? ''), [newPassword]);
  const passwordsMatch = (newPassword ?? '').length > 0 && newPassword === confirmNewPassword;

  const canSubmit =
    status === 'idle' &&
    (currentPassword ?? '').length > 0 &&
    strength.meetsMinimum &&
    passwordsMatch;

  // Reset state whenever the sheet opens/closes.
  useEffect(() => {
    if (!open) {
      reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setShowCurrent(false);
      setShowNew(false);
      setStatus('idle');
      setError(null);
    }
  }, [open, reset]);

  // Focus current-password when the sheet opens.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => currentInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  const onValidSubmit = useCallback(
    async (values: ChangePasswordFormValues) => {
      if (!firebaseUser || !firebaseUser.email) {
        const mapped = mapAuthError({ code: 'auth/user-not-found' });
        setError(mapped);
        toast.error(mapped.title, mapped.body);
        return;
      }

      setStatus('submitting');
      setError(null);
      try {
        const credential = EmailAuthProvider.credential(firebaseUser.email, values.currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
        await updatePassword(firebaseUser, values.newPassword);
        // Force a token refresh so subsequent Firestore writes see the
        // new credentials (R5 risk in PHASE_3.md).
        await firebaseUser.getIdToken(true);

        toast.success('Password updated', 'Your password has been changed successfully.');
        onClose();
      } catch (err: unknown) {
        const mapped = mapAuthError(err);
        // Log structured detail for the server, but never show the raw
        // message to the user.
        log.error('Change password failed', err, { code: mapped.code });
        setError(mapped);
        toast.error(mapped.title, mapped.body);
        // Refocus the offending field for quick retry.
        if (
          mapped.fieldTarget === 'currentPassword' ||
          mapped.code === 'auth/requires-recent-login'
        ) {
          setValue('currentPassword', '', { shouldValidate: false, shouldDirty: false });
          window.setTimeout(() => {
            setFocus('currentPassword');
            currentInputRef.current?.focus();
          }, 50);
        } else if (mapped.fieldTarget === 'newPassword') {
          window.setTimeout(() => {
            setFocus('newPassword');
            newInputRef.current?.focus();
          }, 50);
        }
      } finally {
        setStatus('idle');
      }
    },
    [firebaseUser, onClose, setFocus, setValue, toast],
  );

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && status !== 'submitting') {
        onClose();
      }
    },
    [onClose, status],
  );

  const currentFieldError = error?.fieldTarget === 'currentPassword' ? error : null;
  const newFieldError = error?.fieldTarget === 'newPassword' ? error : null;
  const bannerError = error && !error.fieldTarget ? error : null;

  // Merge the RHF ref with the local focus-management ref so we can still
  // use `currentInputRef.current?.focus()` from our error handler without
  // losing RHF's own ref-tracking.
  const currentRegister = register('currentPassword');
  const newRegister = register('newPassword');

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] flex-col',
            'rounded-t-3xl bg-white shadow-2xl focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full',
            'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
          )}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-maroon-50">
                <ShieldCheck className="h-5 w-5 text-brand-maroon-600" aria-hidden="true" />
              </div>
              <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">
                Change password
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-400"
              disabled={status === 'submitting'}
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="px-5 text-sm text-gray-500">
            Enter your current password, then choose a new one. You will stay signed in.
          </DialogPrimitive.Description>

          <form
            onSubmit={handleSubmit(onValidSubmit)}
            className="flex flex-col gap-4 overflow-y-auto px-5 pt-4 pb-6"
            noValidate
          >
            {bannerError && (
              <div
                role="alert"
                className="rounded-xl border border-brand-maroon-200 bg-brand-maroon-50 px-4 py-3 text-sm text-brand-maroon-800"
              >
                <p className="font-semibold">{bannerError.title}</p>
                <p>{bannerError.body}</p>
              </div>
            )}

            {/* Current password ---------------------------------------------------- */}
            <div className="flex flex-col gap-1">
              <label htmlFor="cps-current" className="text-sm font-medium text-gray-700">
                Current password
              </label>
              <div className="relative">
                <input
                  {...currentRegister}
                  ref={(node) => {
                    currentRegister.ref(node);
                    currentInputRef.current = node;
                  }}
                  id="cps-current"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={currentFieldError || errors.currentPassword ? true : undefined}
                  aria-describedby={
                    currentFieldError
                      ? 'cps-current-err'
                      : errors.currentPassword
                      ? 'cps-current-err'
                      : undefined
                  }
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 pr-12 text-base outline-none',
                    'focus:border-brand-maroon-500 focus:ring-2 focus:ring-brand-maroon-200',
                    currentFieldError || errors.currentPassword
                      ? 'border-brand-maroon-400 bg-brand-maroon-50/30'
                      : 'border-gray-200 bg-white',
                  )}
                  disabled={status === 'submitting'}
                />
                <button
                  type="button"
                  aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                  onClick={() => setShowCurrent((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-300 rounded-r-xl"
                >
                  {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {currentFieldError ? (
                <p id="cps-current-err" className="text-xs text-brand-maroon-700">
                  {currentFieldError.title}
                </p>
              ) : errors.currentPassword ? (
                <p id="cps-current-err" className="text-xs text-brand-maroon-700">
                  {errors.currentPassword.message}
                </p>
              ) : null}
            </div>

            {/* New password -------------------------------------------------------- */}
            <div className="flex flex-col gap-1">
              <label htmlFor="cps-new" className="text-sm font-medium text-gray-700">
                New password
              </label>
              <div className="relative">
                <input
                  {...newRegister}
                  ref={(node) => {
                    newRegister.ref(node);
                    newInputRef.current = node;
                  }}
                  id="cps-new"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={newFieldError || errors.newPassword ? true : undefined}
                  aria-describedby={
                    newFieldError
                      ? 'cps-new-err'
                      : errors.newPassword
                      ? 'cps-new-err'
                      : 'cps-new-strength cps-new-rules'
                  }
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 pr-12 text-base outline-none',
                    'focus:border-brand-maroon-500 focus:ring-2 focus:ring-brand-maroon-200',
                    newFieldError || errors.newPassword
                      ? 'border-brand-maroon-400 bg-brand-maroon-50/30'
                      : 'border-gray-200 bg-white',
                  )}
                  disabled={status === 'submitting'}
                />
                <button
                  type="button"
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-300 rounded-r-xl"
                >
                  {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {newFieldError ? (
                <p id="cps-new-err" className="text-xs text-brand-maroon-700">
                  {newFieldError.title}
                </p>
              ) : errors.newPassword ? (
                <p id="cps-new-err" className="text-xs text-brand-maroon-700">
                  {errors.newPassword.message}
                </p>
              ) : (
                <>
                  <div
                    id="cps-new-strength"
                    aria-live="polite"
                    className="flex items-center gap-2 pt-1"
                  >
                    <div className="flex flex-1 gap-1" aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-1.5 flex-1 rounded-full',
                            i < strength.score
                              ? strength.score >= 3
                                ? 'bg-emerald-500'
                                : strength.score === 2
                                ? 'bg-brand-gold-500'
                                : 'bg-brand-maroon-500'
                              : 'bg-gray-200',
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{strength.label}</span>
                  </div>
                  <ul
                    id="cps-new-rules"
                    className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1 text-xs"
                  >
                    <Rule ok={strength.rules.length} label="At least 8 characters" />
                    <Rule ok={strength.rules.lowerAndUpper} label="Upper + lowercase" />
                    <Rule ok={strength.rules.digit} label="Contains a number" />
                    <Rule ok={strength.rules.symbol} label="Contains a symbol" />
                  </ul>
                </>
              )}
            </div>

            {/* Confirm password ---------------------------------------------------- */}
            <div className="flex flex-col gap-1">
              <label htmlFor="cps-confirm" className="text-sm font-medium text-gray-700">
                Confirm new password
              </label>
              <input
                {...register('confirmNewPassword')}
                id="cps-confirm"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={
                  (confirmNewPassword ?? '').length > 0 && !passwordsMatch ? true : undefined
                }
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-base outline-none',
                  'focus:border-brand-maroon-500 focus:ring-2 focus:ring-brand-maroon-200',
                  (confirmNewPassword ?? '').length > 0 && !passwordsMatch
                    ? 'border-brand-maroon-400 bg-brand-maroon-50/30'
                    : 'border-gray-200 bg-white',
                )}
                disabled={status === 'submitting'}
              />
              {(confirmNewPassword ?? '').length > 0 && !passwordsMatch && (
                <p className="text-xs text-brand-maroon-700">Passwords do not match.</p>
              )}
            </div>

            {/* Footer actions ------------------------------------------------------ */}
            <div className="mt-2 flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                aria-busy={status === 'submitting'}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-white',
                  'bg-gradient-to-r from-brand-gold-500 to-brand-maroon-500',
                  'shadow-md transition hover:brightness-105',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-300 focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'submitting'}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-300 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Rule({ ok, label }: { readonly ok: boolean; readonly label: string }): JSX.Element {
  return (
    <li className={cn('flex items-center gap-1', ok ? 'text-emerald-700' : 'text-gray-500')}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          ok ? 'bg-emerald-500' : 'bg-gray-300',
        )}
      />
      {label}
    </li>
  );
}

export default ChangePasswordSheet;
