'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Gift,
  Copy,
  Check,
  Share2,
  MessageCircle,
  Coins,
  Star,
  Sparkles,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import type { User as FirebaseUser } from 'firebase/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
  readonly firebaseUser: FirebaseUser | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
}

interface StepItem {
  readonly number: number;
  readonly title: string;
  readonly description: string;
}

interface RewardTier {
  readonly label: string;
  readonly value: string;
  readonly icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS: readonly StepItem[] = [
  {
    number: 1,
    title: 'Share your code',
    description: 'Send your unique code to friends and family',
  },
  {
    number: 2,
    title: 'Friend books a service',
    description: 'They get a discount on their first booking',
  },
  {
    number: 3,
    title: 'You earn coins',
    description: 'Get 100 Glamour coins for each successful referral',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateReferralCode(uid: string): string {
  return `GLAM${uid.slice(0, 6).toUpperCase()}`;
}

function buildShareUrl(origin: string, code: string): string {
  return `${origin}/auth/register?ref=${code}`;
}

function buildShareText(code: string, url: string): string {
  return (
    `Hey! I love using Glamornate for premium spa bookings. ` +
    `Use my referral code ${code} to get a discount on your first booking! ` +
    url
  );
}

function useAuthSafe(): AuthState {
  // useAuth is called unconditionally (Rules of Hooks).
  // If AuthProvider is absent, useAuth itself returns safe defaults.
  let firebaseUser: FirebaseUser | null = null;
  let isLoading = false;
  let isAuthenticated = false;
  try {
    const auth = useAuth();
    firebaseUser = auth.firebaseUser ?? null;
    isLoading = auth.isLoading;
    isAuthenticated = auth.isAuthenticated;
  } catch {
    // AuthProvider not mounted — use defaults
  }
  return { firebaseUser, isLoading, isAuthenticated };
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function ReferralSkeleton() {
  return (
    <div className="min-h-screen bg-section-bg pb-24">
      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-6 pt-14 pb-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 animate-pulse" />
          <div className="mt-4 h-7 w-56 bg-white/10 rounded animate-pulse" />
          <div className="mt-2 h-4 w-64 bg-white/10 rounded animate-pulse" />
          <div className="mt-5 h-10 w-36 bg-white/10 rounded-xl animate-pulse" />
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        <div className="bg-white rounded-2xl shadow-sm h-36 animate-pulse" />
        <div className="bg-white rounded-2xl shadow-sm h-28 animate-pulse" />
        <div className="bg-white rounded-2xl shadow-sm h-56 animate-pulse" />
        <div className="bg-white rounded-2xl shadow-sm h-40 animate-pulse" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero Banner
// ---------------------------------------------------------------------------

function HeroBanner({ coinsEarned }: { readonly coinsEarned: number }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-6 pt-14 pb-8">
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-gold-500/15">
          <Gift className="w-8 h-8 text-brand-gold-400" />
        </div>

        <h1 className="mt-4 text-2xl font-bold text-white">
          Refer Friends, Earn Rewards
        </h1>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed max-w-xs">
          Share the love of wellness. Earn coins for every friend who books.
        </p>

        <div className="mt-5 flex items-center gap-2 bg-white/10 border border-white/10 px-5 py-2.5 rounded-xl">
          <Coins className="w-5 h-5 text-brand-gold-400" />
          <span className="text-sm font-bold text-white">
            {coinsEarned} coins earned
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Referral Code Card
// ---------------------------------------------------------------------------

function ReferralCodeCard({
  isAuthenticated,
  referralCode,
}: {
  readonly isAuthenticated: boolean;
  readonly referralCode: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in non-HTTPS contexts
    }
  }, [referralCode]);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Your referral code
        </h2>

        {isAuthenticated && referralCode ? (
          <div className="flex flex-col items-center">
            <div className="w-full border-2 border-dashed border-brand-maroon-200 bg-brand-maroon-50/50 rounded-xl px-6 py-4 text-center">
              <p className="text-xl font-bold tracking-wider text-brand-maroon-700">
                {referralCode}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Your unique referral code
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 flex items-center gap-2 bg-brand-maroon-50 text-brand-maroon-600 hover:bg-brand-maroon-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Code
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-maroon-50 mb-3">
              <LogIn className="w-6 h-6 text-brand-maroon-300" />
            </div>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Login to get your referral code
            </p>
            <Link
              href="/auth/login?callbackUrl=%2Freferral"
              className="inline-flex items-center gap-2 bg-brand-maroon-500 hover:bg-brand-maroon-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              Login / Signup
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share Section
// ---------------------------------------------------------------------------

function ShareSection({
  referralCode,
  shareUrl,
}: {
  readonly referralCode: string | null;
  readonly shareUrl: string;
}) {
  const [linkCopied, setLinkCopied] = useState(false);

  const shareText = referralCode
    ? buildShareText(referralCode, shareUrl)
    : '';

  const handleWhatsApp = useCallback(() => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }, [shareText]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: 'Join Glamornate',
        text: shareText,
        url: shareUrl,
      });
    } catch {
      // User cancelled share
    }
  }, [shareText, shareUrl]);

  if (!referralCode) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Share with friends
        </h2>

        <div className="flex items-center gap-3">
          {/* WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex-1 flex flex-col items-center gap-2 bg-green-50 text-green-700 rounded-xl py-3.5 px-3 transition-colors hover:bg-green-100 active:scale-[0.98]"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">WhatsApp</span>
          </button>

          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-1 flex flex-col items-center gap-2 bg-brand-maroon-50 text-brand-maroon-600 rounded-xl py-3.5 px-3 transition-colors hover:bg-brand-maroon-100 active:scale-[0.98]"
          >
            {linkCopied ? (
              <Check className="w-5 h-5" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
            <span className="text-xs font-medium">
              {linkCopied ? 'Copied!' : 'Copy Link'}
            </span>
          </button>

          {/* More (native share) */}
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex-1 flex flex-col items-center gap-2 bg-gray-50 text-gray-700 rounded-xl py-3.5 px-3 transition-colors hover:bg-gray-100 active:scale-[0.98]"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// How It Works
// ---------------------------------------------------------------------------

function HowItWorks() {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-5">
          How it works
        </h2>

        <div className="space-y-0">
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <div key={step.number} className="relative flex gap-4">
                {/* Vertical connecting line */}
                {!isLast && (
                  <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
                )}

                {/* Number circle */}
                <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-brand-maroon-500 text-white text-sm font-bold flex items-center justify-center">
                  {step.number}
                </div>

                {/* Text */}
                <div className={isLast ? 'pb-0' : 'pb-6'}>
                  <p className="text-sm font-semibold text-gray-900">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rewards Info
// ---------------------------------------------------------------------------

function RewardsInfo() {
  const tiers: readonly RewardTier[] = [
    {
      label: 'Per Referral',
      value: '100 coins',
      icon: <Coins className="w-5 h-5 text-brand-gold-500" />,
    },
    {
      label: '5 Referrals',
      value: 'Bonus 200 coins',
      icon: <Star className="w-5 h-5 text-brand-gold-500" />,
    },
    {
      label: '10 Referrals',
      value: 'Free Service worth \u20B9999',
      icon: <Sparkles className="w-5 h-5 text-brand-gold-500" />,
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <h2 className="text-base font-semibold text-gray-900 mb-2">
          What you can earn
        </h2>
      </div>

      {tiers.map((tier, index) => {
        const isLast = index === tiers.length - 1;
        return (
          <div
            key={tier.label}
            className={`flex items-center justify-between px-5 py-3.5 ${
              isLast ? '' : 'border-b border-gray-100'
            }`}
          >
            <span className="text-sm font-medium text-gray-800">
              {tier.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-brand-maroon-600">
                {tier.value}
              </span>
              {tier.icon}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReferralPage() {
  const { firebaseUser, isLoading, isAuthenticated } = useAuthSafe();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (isLoading) {
    return <ReferralSkeleton />;
  }

  const referralCode = firebaseUser
    ? generateReferralCode(firebaseUser.uid)
    : null;

  const origin = hasMounted
    ? window.location.origin
    : 'https://glamornate.com';

  const shareUrl = referralCode
    ? buildShareUrl(origin, referralCode)
    : '';

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Hero Banner */}
      <HeroBanner coinsEarned={0} />

      {/* Content */}
      <div className="px-4 pt-4 space-y-3">
        {/* Referral Code */}
        <ReferralCodeCard
          isAuthenticated={isAuthenticated}
          referralCode={referralCode}
        />

        {/* Share */}
        <ShareSection referralCode={referralCode} shareUrl={shareUrl} />

        {/* How It Works */}
        <HowItWorks />

        {/* Rewards */}
        <RewardsInfo />

        {/* Terms */}
        <p className="text-center text-xs text-gray-400 pt-2 pb-4">
          Terms &amp; conditions apply. Coins expire 6 months from date of
          credit.
        </p>
      </div>
    </div>
  );
}
