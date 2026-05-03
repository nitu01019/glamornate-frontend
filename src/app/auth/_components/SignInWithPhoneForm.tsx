/** M-NOTIFY recovery stub (2026-04-25). Original lost in git clean. Replace with real impl when found. */
'use client';

import { useState, useRef, useEffect } from 'react';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase-client/index';
import { Loader2, Phone, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { phoneOtpEnabled } from '@/lib/feature-flags';

export interface SignInWithPhoneFormProps {
  /** Optionally disable the form (e.g. while parent is busy). */
  disabled?: boolean;
}

type Step = 'phone' | 'otp';

/**
 * Two-step Firebase phone OTP sign-in form (internal implementation).
 * Step 1: user enters phone number → triggers signInWithPhoneNumber.
 * Step 2: user enters OTP → calls confirmationResult.confirm().
 *
 * Not exported directly — gated by `SignInWithPhoneForm` wrapper which
 * checks `phoneOtpEnabled` before mounting any hooks.
 */
function SignInWithPhoneFormImpl({ disabled = false }: SignInWithPhoneFormProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ConfirmationResult not yet typed in stub; replace with ConfirmationResult when real impl lands
  const confirmationRef = useRef<any>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RecaptchaVerifier instance stored for cleanup
  const recaptchaRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const auth = getFirebaseAuth();
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current!, {
          size: 'invisible',
        });
      }
      const result = await signInWithPhoneNumber(auth, phone, recaptchaRef.current);
      confirmationRef.current = result;
      setStep('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationRef.current) return;
    setError(null);
    setIsLoading(true);

    try {
      await confirmationRef.current.confirm(otp);
      // Auth state listener in auth-provider will handle redirect.
    } catch (err: unknown) {
      // Phase 4 (Booking Flow Fix v3.1, 2026-05-02): cross-provider
      // conflict during phone-OTP verification routes to the linking flow.
      const code = (err as { code?: string } | null)?.code;
      if (code === 'auth/account-exists-with-different-credential') {
        if (typeof window !== 'undefined') {
          window.location.assign('/customer/account/link?reason=cross_provider');
        }
      }
      const msg = err instanceof Error ? err.message : 'Invalid OTP. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Invisible reCAPTCHA container */}
      <div ref={recaptchaContainerRef} />

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {step === 'phone' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="phone-input"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={disabled || isLoading}
                className={cn(
                  'w-full h-14 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-2xl',
                  'text-gray-900 placeholder-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:border-brand-gold-500',
                  'transition-colors disabled:opacity-50',
                )}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={disabled || isLoading || !phone}
            className={cn(
              'w-full h-14 font-semibold text-white rounded-2xl',
              'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500',
              'flex items-center justify-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'active:scale-[0.98] transition-transform',
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Sending OTP...
              </>
            ) : (
              'Send OTP'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label htmlFor="otp-input" className="block text-sm font-medium text-gray-700 mb-2">
              Enter OTP sent to {phone}
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
                disabled={disabled || isLoading}
                className={cn(
                  'w-full h-14 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-2xl',
                  'text-gray-900 placeholder-gray-400 tracking-widest text-center text-lg',
                  'focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:border-brand-gold-500',
                  'transition-colors disabled:opacity-50',
                )}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={disabled || isLoading || otp.length < 6}
            className={cn(
              'w-full h-14 font-semibold text-white rounded-2xl',
              'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500',
              'flex items-center justify-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'active:scale-[0.98] transition-transform',
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify OTP'
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setOtp('');
              setError(null);
            }}
            className="w-full text-sm text-brand-maroon-500 hover:text-brand-maroon-600 py-2"
          >
            Use a different number
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * @deprecated 2026-04-26 — phone OTP path disabled behind `phoneOtpEnabled` flag
 * (see frontend/src/lib/feature-flags.ts). Firebase Auth built-in (Google + email)
 * is the supported sign-in flow. See docs/superpowers/specs/2026-04-26-needs-work-fix-plan.md §Phase 1.
 *
 * The flag check happens BEFORE the underlying component mounts, so no hooks
 * run while the feature is disabled (preserves Rules of Hooks).
 */
export default function SignInWithPhoneForm(props: SignInWithPhoneFormProps) {
  if (!phoneOtpEnabled) return null;
  return <SignInWithPhoneFormImpl {...props} />;
}
