'use client';

/**
 * DeleteAccountSheet
 * ------------------
 * Three-step bottom sheet that performs a cascading, Play-Store-compliant
 * account deletion against 3A's `deleteAccount` callable.
 *
 * Steps:
 *   1. Explanation — enumerate the data that will be removed and require
 *      the user to tap "I understand" AND type the exact confirmation
 *      phrase `DELETE MY ACCOUNT` (case-sensitive). This step is a gated
 *      ritual rather than a validated form — the ack checkbox + literal
 *      phrase equality stays local component state so the step-machine
 *      remains explicit and testable.
 *   2. Re-auth — prompt for current password; we call
 *      `reauthenticateWithCredential` so 3A's recent-login window
 *      (≤ 5 minutes) is satisfied. Step 2 is the only true <form> in
 *      this sheet and is powered by `react-hook-form` + `zodResolver`
 *      over `deleteAccountReauthSchema`.
 *   3. Execute — invoke `deleteAccount`. On success, call the hardened
 *      `signOut()` (which sweeps client state via 3C's `sweepClientState`)
 *      and redirect to `/auth/login?accountDeleted=1`.
 *
 * Error handling: every Firebase Auth error and every HttpsError returned
 * by 3A routes through `mapAuthError`. On `requires-recent-login` we
 * reopen step 2. On `invalid-argument` / confirmation mismatch we reopen
 * step 1. Raw Firebase detail is never shown to the user — `console.error`
 * captures it for ops visibility.
 *
 * Accessibility:
 *   - Radix Dialog handles focus trap + Escape close (disabled while
 *     deletion is in flight to prevent accidental dismissal mid-cascade).
 *   - Uses `prefers-reduced-motion` friendly variants.
 *   - Live regions narrate step transitions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CreditCard,
  Eye,
  EyeOff,
  Heart,
  Loader2,
  MapPin,
  MessageSquare,
  Star,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { useAuth } from '@/lib/auth-provider';
import { getFirebaseApp } from '@/lib/firebase-client';
import { useToastActions } from '@/lib/providers';
import { mapAuthError, type MappedAuthError } from '@/lib/account/auth-error-map';
import {
  deleteAccountReauthSchema,
  type DeleteAccountReauthValues,
} from '@/lib/schemas/delete-account';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'DeleteAccountSheet' });

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface DeleteAccountSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants (mirror 3A's server contract)
// ---------------------------------------------------------------------------

/**
 * The exact phrase 3A's Zod schema expects. MUST match
 * backend/functions/src/callable/deleteAccount.ts `DELETE_CONFIRMATION`.
 */
export const DELETE_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

/** Callable name registered at deploy time. */
const DELETE_ACCOUNT_CALLABLE = 'deleteAccount';

/** Functions region — mirrors 3A's `.region('us-central1')`. */
const FUNCTIONS_REGION = 'us-central1';

/** Where we redirect after a successful deletion. */
const POST_DELETE_REDIRECT = '/auth/login?accountDeleted=1';

// ---------------------------------------------------------------------------
// Step 1 copy: what gets deleted
// ---------------------------------------------------------------------------

const DELETED_DATA_ITEMS: ReadonlyArray<{
  readonly icon: typeof UserIcon;
  readonly label: string;
  readonly body: string;
}> = [
  { icon: UserIcon, label: 'Profile', body: 'Your name, email, and phone number.' },
  { icon: Calendar, label: 'Bookings', body: 'All past, active, and upcoming bookings.' },
  {
    icon: CreditCard,
    label: 'Payments & wallet',
    body: 'Saved payment methods and wallet balance.',
  },
  { icon: MapPin, label: 'Addresses', body: 'Home, work, and saved locations.' },
  { icon: Star, label: 'Reviews', body: 'Every review you have left will be removed.' },
  { icon: Heart, label: 'Favourites', body: 'Spas and services you have saved.' },
  { icon: Bell, label: 'Notifications', body: 'Your notification history and preferences.' },
  {
    icon: MessageSquare,
    label: 'Support messages',
    body: 'Tickets and chat history with support.',
  },
];

// ---------------------------------------------------------------------------
// Callable response shape (3A contract)
// ---------------------------------------------------------------------------

interface DeleteAccountCallableResponse {
  readonly success: boolean;
  readonly alreadyDeleted?: boolean;
  readonly warnings?: readonly string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Step = 'explain' | 'reauth' | 'executing';
type Status = 'idle' | 'reauthenticating' | 'deleting';

export function DeleteAccountSheet({ open, onClose }: DeleteAccountSheetProps): JSX.Element {
  const { firebaseUser, signOut } = useAuth();
  const router = useRouter();
  const toast = useToastActions();

  const [step, setStep] = useState<Step>('explain');
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<MappedAuthError | null>(null);

  const confirmationRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  // Step 2's re-auth form — RHF + zodResolver so the password field is
  // validated against `deleteAccountReauthSchema` before we try to fire
  // the Firebase reauthenticate call.
  const form = useForm<DeleteAccountReauthValues>({
    resolver: zodResolver(deleteAccountReauthSchema),
    defaultValues: { currentPassword: '' },
    mode: 'onSubmit',
  });
  const { register, handleSubmit, reset, watch, setValue } = form;
  const currentPassword = watch('currentPassword');

  const confirmationMatches = confirmationInput === DELETE_CONFIRMATION_PHRASE;
  const canAdvanceToReauth = acknowledged && confirmationMatches;
  const canExecute = status === 'idle' && (currentPassword ?? '').length > 0;

  // Reset whenever the sheet closes.
  useEffect(() => {
    if (!open) {
      setStep('explain');
      setAcknowledged(false);
      setConfirmationInput('');
      reset({ currentPassword: '' });
      setShowPassword(false);
      setStatus('idle');
      setError(null);
    }
  }, [open, reset]);

  // Focus helpers on step transitions.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      if (step === 'explain') confirmationRef.current?.focus();
      else if (step === 'reauth') passwordRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open, step]);

  const closeIfAllowed = useCallback(() => {
    if (status === 'idle') onClose();
  }, [status, onClose]);

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) closeIfAllowed();
    },
    [closeIfAllowed],
  );

  const handleAdvance = useCallback(() => {
    if (!canAdvanceToReauth) return;
    setError(null);
    setStep('reauth');
  }, [canAdvanceToReauth]);

  const runDeletion = useCallback(
    async (values: DeleteAccountReauthValues) => {
      if (status !== 'idle') return;

      if (!firebaseUser || !firebaseUser.email) {
        const mapped = mapAuthError({ code: 'auth/user-not-found' });
        setError(mapped);
        toast.error(mapped.title, mapped.body);
        return;
      }

      // Step 2a: reauth
      setStatus('reauthenticating');
      setError(null);
      try {
        const credential = EmailAuthProvider.credential(firebaseUser.email, values.currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
        await firebaseUser.getIdToken(true);
      } catch (err: unknown) {
        const mapped = mapAuthError(err);
        log.error('Re-auth before delete failed', err, { code: mapped.code });
        setError(mapped);
        toast.error(mapped.title, mapped.body);
        setValue('currentPassword', '', { shouldValidate: false, shouldDirty: false });
        setStatus('idle');
        window.setTimeout(() => passwordRef.current?.focus(), 50);
        return;
      }

      // Step 2b: call the cloud function
      setStatus('deleting');
      setStep('executing');
      try {
        const functions = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
        const callable = httpsCallable<
          { confirmationString: string },
          DeleteAccountCallableResponse
        >(functions, DELETE_ACCOUNT_CALLABLE);
        const result = await callable({ confirmationString: DELETE_CONFIRMATION_PHRASE });

        if (!result.data || result.data.success !== true) {
          throw new Error('account/internal');
        }

        // Success — sweep client state and redirect.
        try {
          await signOut();
        } catch (sweepError: unknown) {
          // Sign-out sweep failing is not user-facing — deletion already
          // succeeded on the server. Log and continue to redirect.
          log.error('Post-delete signOut sweep failed', sweepError);
        }

        toast.success(
          'Account deleted',
          'Your account and data have been removed. We are sorry to see you go.',
        );
        router.push(POST_DELETE_REDIRECT);
      } catch (err: unknown) {
        const mapped = mapAuthError(err);
        log.error('deleteAccount callable failed', err, { code: mapped.code });

        if (
          mapped.code === 'account/requires-recent-login' ||
          mapped.code === 'functions/failed-precondition' ||
          mapped.code === 'auth/requires-recent-login'
        ) {
          // Send the user back to the re-auth step.
          setStep('reauth');
          setValue('currentPassword', '', { shouldValidate: false, shouldDirty: false });
          window.setTimeout(() => passwordRef.current?.focus(), 50);
        } else if (
          mapped.code === 'account/invalid-confirmation' ||
          mapped.code === 'functions/invalid-argument'
        ) {
          // Send the user back to the explanation step.
          setStep('explain');
          setConfirmationInput('');
          setAcknowledged(false);
          window.setTimeout(() => confirmationRef.current?.focus(), 50);
        } else {
          // Stay on the re-auth step so the user can retry.
          setStep('reauth');
        }

        setError(mapped);
        toast.error(mapped.title, mapped.body);
        setStatus('idle');
      }
    },
    [firebaseUser, router, setValue, signOut, status, toast],
  );

  const bannerError = error && !error.fieldTarget ? error : null;
  const passwordFieldError = error?.fieldTarget === 'currentPassword' ? error : null;

  const heading = useMemo(() => {
    if (step === 'explain') return 'Delete your account';
    if (step === 'reauth') return 'Confirm your password';
    return 'Deleting your account';
  }, [step]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      // While the deletion cascade is in flight, don't let Escape dismiss.
      // Radix reads `onEscapeKeyDown` from `Content` below.
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
          )}
        />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            if (status !== 'idle') e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (status !== 'idle') e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (status !== 'idle') e.preventDefault();
          }}
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="h-5 w-5 text-red-600" aria-hidden="true" />
              </div>
              <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">
                {heading}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              disabled={status !== 'idle'}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="sr-only">
            Permanently delete your Glamornate account. This action cannot be undone.
          </DialogPrimitive.Description>

          {step === 'explain' && (
            <ExplainStep
              acknowledged={acknowledged}
              confirmationInput={confirmationInput}
              confirmationMatches={confirmationMatches}
              onAcknowledgeToggle={() => setAcknowledged((a) => !a)}
              onConfirmationChange={setConfirmationInput}
              onCancel={onClose}
              onAdvance={handleAdvance}
              canAdvance={canAdvanceToReauth}
              confirmationRef={confirmationRef}
              banner={bannerError}
            />
          )}

          {step === 'reauth' && (
            <ReauthStep
              register={register}
              handleSubmit={handleSubmit(runDeletion)}
              show={showPassword}
              onToggleShow={() => setShowPassword((s) => !s)}
              onBack={() => {
                setStep('explain');
                setError(null);
              }}
              submitting={status !== 'idle'}
              passwordRef={passwordRef}
              passwordError={passwordFieldError}
              banner={bannerError}
              canExecute={canExecute}
            />
          )}

          {step === 'executing' && <ExecutingStep />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Explanation
// ---------------------------------------------------------------------------

function ExplainStep({
  acknowledged,
  confirmationInput,
  confirmationMatches,
  onAcknowledgeToggle,
  onConfirmationChange,
  onCancel,
  onAdvance,
  canAdvance,
  confirmationRef,
  banner,
}: {
  readonly acknowledged: boolean;
  readonly confirmationInput: string;
  readonly confirmationMatches: boolean;
  readonly onAcknowledgeToggle: () => void;
  readonly onConfirmationChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly onAdvance: () => void;
  readonly canAdvance: boolean;
  readonly confirmationRef: React.MutableRefObject<HTMLInputElement | null>;
  readonly banner: MappedAuthError | null;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pt-2 pb-6">
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <p>
          Deleting your account is <strong>permanent</strong>. Once confirmed, we cannot restore
          your data — not even from backups.
        </p>
      </div>

      {banner && (
        <div
          role="alert"
          className="rounded-xl border border-brand-maroon-200 bg-brand-maroon-50 px-4 py-3 text-sm text-brand-maroon-800"
        >
          <p className="font-semibold">{banner.title}</p>
          <p>{banner.body}</p>
        </div>
      )}

      <section aria-labelledby="dlt-what" className="flex flex-col gap-2">
        <h3 id="dlt-what" className="text-sm font-semibold text-gray-900">
          What will be deleted
        </h3>
        <ul className="flex flex-col gap-2">
          {DELETED_DATA_ITEMS.map(({ icon: Icon, label, body }) => (
            <li
              key={label}
              className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <label className="flex items-start gap-3 rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={onAcknowledgeToggle}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
        />
        <span>
          <strong>I understand</strong> that my account and all associated data will be permanently
          removed.
        </span>
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="dlt-confirm" className="text-sm font-medium text-gray-700">
          Type <span className="font-mono text-red-600">{DELETE_CONFIRMATION_PHRASE}</span> to
          continue
        </label>
        <input
          ref={confirmationRef}
          id="dlt-confirm"
          name="delete-confirmation"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={confirmationInput}
          onChange={(e) => onConfirmationChange(e.target.value)}
          aria-invalid={confirmationInput.length > 0 && !confirmationMatches ? true : undefined}
          className={cn(
            'w-full rounded-xl border px-4 py-3 font-mono text-base tracking-wider outline-none',
            'focus:border-red-500 focus:ring-2 focus:ring-red-200',
            confirmationInput.length > 0 && !confirmationMatches
              ? 'border-red-400 bg-red-50/30'
              : 'border-gray-200 bg-white',
          )}
        />
        {confirmationInput.length > 0 && !confirmationMatches && (
          <p className="text-xs text-red-700">The phrase must match exactly.</p>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={onAdvance}
          disabled={!canAdvance}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-white',
            'bg-red-600 hover:bg-red-700 shadow-md transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          Keep my account
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Re-auth
// ---------------------------------------------------------------------------

type ReauthFormRegister = ReturnType<
  ReturnType<typeof useForm<DeleteAccountReauthValues>>['register']
>;

function ReauthStep({
  register,
  handleSubmit,
  show,
  onToggleShow,
  onBack,
  submitting,
  passwordRef,
  passwordError,
  banner,
  canExecute,
}: {
  readonly register: (name: 'currentPassword') => ReauthFormRegister;
  readonly handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly show: boolean;
  readonly onToggleShow: () => void;
  readonly onBack: () => void;
  readonly submitting: boolean;
  readonly passwordRef: React.MutableRefObject<HTMLInputElement | null>;
  readonly passwordError: MappedAuthError | null;
  readonly banner: MappedAuthError | null;
  readonly canExecute: boolean;
}): JSX.Element {
  const passwordRegister = register('currentPassword');
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 overflow-y-auto px-5 pt-2 pb-6"
      noValidate
    >
      <p className="text-sm text-gray-600">
        For your security, please re-enter your password to confirm this is really you.
      </p>

      {banner && (
        <div
          role="alert"
          className="rounded-xl border border-brand-maroon-200 bg-brand-maroon-50 px-4 py-3 text-sm text-brand-maroon-800"
        >
          <p className="font-semibold">{banner.title}</p>
          <p>{banner.body}</p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="dlt-pwd" className="text-sm font-medium text-gray-700">
          Current password
        </label>
        <div className="relative">
          <input
            {...passwordRegister}
            ref={(node) => {
              passwordRegister.ref(node);
              passwordRef.current = node;
            }}
            id="dlt-pwd"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'dlt-pwd-err' : undefined}
            className={cn(
              'w-full rounded-xl border px-4 py-3 pr-12 text-base outline-none',
              'focus:border-red-500 focus:ring-2 focus:ring-red-200',
              passwordError ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white',
            )}
            disabled={submitting}
          />
          <button
            type="button"
            aria-label={show ? 'Hide password' : 'Show password'}
            onClick={onToggleShow}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 rounded-r-xl"
          >
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {passwordError && (
          <p id="dlt-pwd-err" className="text-xs text-red-700">
            {passwordError.title}
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2 pt-2">
        <button
          type="submit"
          disabled={!canExecute}
          aria-busy={submitting}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-white',
            'bg-red-600 hover:bg-red-700 shadow-md transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {submitting ? (
            <>
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Deleting…
            </>
          ) : (
            'Permanently delete my account'
          )}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"
        >
          Back
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Executing (spinner)
// ---------------------------------------------------------------------------

function ExecutingStep(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 px-5 py-10 text-center"
    >
      <Loader2
        className="h-10 w-10 animate-spin text-red-600 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="text-base font-medium text-gray-900">Deleting your account…</p>
      <p className="text-sm text-gray-600">
        This can take a few seconds. Please keep this window open.
      </p>
    </div>
  );
}

export default DeleteAccountSheet;
