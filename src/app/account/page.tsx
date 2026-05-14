'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
  User,
  MapPin,
  HelpCircle,
  Wallet,
  Gift,
  Briefcase,
  Globe,
  Share2,
  Info,
  Shield,
  FileText,
  Bell,
  Mail,
  Crown,
  BookOpen,
  LogOut,
  Coins,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { Skeleton } from '@/components/ui/LoadingState';
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import { userService } from '@/lib/firebase-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuRowProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly trailing?: React.ReactNode;
  readonly showDivider?: boolean;
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function AccountSkeleton() {
  return (
    <div className="min-h-screen bg-section-bg pb-24">
      {/* Profile header skeleton */}
      <div className="bg-white px-4 pt-6 pb-5">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        {/* Elite banner skeleton */}
        <Skeleton className="mt-5 h-20 w-full rounded-2xl" />
        {/* Quick actions skeleton */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>

      {/* Menu sections skeleton */}
      <div className="px-4 pt-4 space-y-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu Row
// ---------------------------------------------------------------------------

function MenuRow({ icon, label, href, onClick, trailing, showDivider = true }: MenuRowProps) {
  const content = (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-colors ${
        showDivider ? 'border-b border-gray-100' : ''
      }`}
    >
      <span className="text-gray-500 flex-shrink-0">{icon}</span>
      <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
      {trailing ?? <ChevronRight className="w-4 h-4 text-gray-400" />}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ---------------------------------------------------------------------------
// Section Card
// ---------------------------------------------------------------------------

function SectionCard({ children }: { readonly children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl shadow-sm overflow-hidden">{children}</div>;
}

// ---------------------------------------------------------------------------
// Guest Header (not logged in)
// ---------------------------------------------------------------------------

function GuestHeader() {
  return (
    <div className="bg-white px-4 pt-6 pb-5">
      <div className="flex items-center gap-4 mb-1">
        <div className="w-16 h-16 rounded-full bg-brand-maroon-50 flex items-center justify-center">
          <User className="w-8 h-8 text-brand-maroon-300" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Your Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Log in or sign up to view your complete profile
          </p>
        </div>
      </div>
      <Link
        href="/auth/login?callbackUrl=%2Faccount"
        className="mt-4 block w-full text-center bg-brand-maroon-500 hover:bg-brand-maroon-600 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors active:scale-[0.98]"
      >
        Login / Signup
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Authenticated Header
// ---------------------------------------------------------------------------

function AuthenticatedHeader({
  displayName,
  phone,
  photo,
  userId,
  onPhotoChange,
}: {
  readonly displayName: string;
  readonly phone?: string;
  readonly photo?: string;
  readonly userId: string;
  readonly onPhotoChange: (url: string) => void;
}) {
  return (
    <div className="bg-white px-4 pt-6 pb-5">
      {/* Profile row */}
      <div className="flex items-center gap-4">
        <AvatarUpload
          currentPhoto={photo}
          onPhotoChange={onPhotoChange}
          userId={userId}
          size={64}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{displayName}</h1>
          {phone && <p className="text-sm text-gray-500 mt-0.5">{phone}</p>}
        </div>
        {/* Coins badge */}
        <div className="flex items-center gap-1 bg-brand-gold-50 px-2.5 py-1 rounded-full">
          <Coins className="w-4 h-4 text-brand-gold-500" />
          <span className="text-xs font-semibold text-brand-gold-700">0</span>
        </div>
      </div>

      {/* Elite membership banner */}
      <Link
        href="/customer/elite"
        className="mt-5 block rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 p-4 active:opacity-90 transition-opacity"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Crown className="w-4 h-4 text-brand-gold-400" />
              <span className="text-sm font-bold text-brand-gold-400">Elite Membership</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Save more than 3X on every booking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-gold-400 bg-brand-gold-400/10 px-3 py-1.5 rounded-lg">
              Join Elite @ &#x20B9;249
            </span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </Link>

      {/* Quick action grid */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Link
          href="/customer/bookings"
          className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl py-4 px-2 shadow-sm active:bg-gray-50 transition-colors"
        >
          <BookOpen className="w-5 h-5 text-brand-maroon-500" />
          <span className="text-xs font-medium text-gray-700 text-center">My Bookings</span>
        </Link>
        <Link
          href="/customer/addresses"
          className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl py-4 px-2 shadow-sm active:bg-gray-50 transition-colors"
        >
          <MapPin className="w-5 h-5 text-brand-maroon-500" />
          <span className="text-xs font-medium text-gray-700 text-center">Addresses</span>
        </Link>
        <Link
          href="/help"
          className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl py-4 px-2 shadow-sm active:bg-gray-50 transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-brand-maroon-500" />
          <span className="text-xs font-medium text-gray-700 text-center">Help Center</span>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AccountPage() {
  const { isAuthenticated, isLoading, user, firebaseUser, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  // Authenticated users get the richer /customer/profile experience (with
  // working Delete Account sheet + Change Password). This page stays as the
  // guest-facing surface only — guests land here from the tab bar before
  // signing in. `router.replace` so back-button doesn't return here.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/customer/profile');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleShareApp = useCallback(() => {
    const url = window.location.origin;
    const shareData = {
      title: 'Glamornate',
      text: 'Check out Glamornate - Premium spa services at your doorstep!',
      url,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        // User cancelled or API unavailable
      });
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setShareMessage('Link copied!');
          setTimeout(() => setShareMessage(null), 2000);
        })
        .catch(() => {
          // Clipboard write failed
        });
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // Sign out error handled in auth provider
    }
  }, [signOut]);

  const handlePhotoChange = useCallback(
    async (url: string) => {
      if (!firebaseUser) return;
      try {
        await userService.updateUser(firebaseUser.uid, {
          profile: {
            ...user?.profile,
            displayName: user?.profile?.displayName ?? 'User',
            photo: url,
          },
          updatedAt: new Date().toISOString(),
        } as Partial<import('@/types').User>);
        await refreshUser();
      } catch {
        // Photo update error -- upload itself already succeeded so the URL is valid
      }
    },
    [firebaseUser, user, refreshUser],
  );

  if (isLoading || isAuthenticated) {
    // Authenticated users see a brief skeleton before the redirect takes
    // effect; guests never hit this branch.
    return <AccountSkeleton />;
  }

  const displayName = user?.profile?.displayName ?? 'User';
  const phone = user?.profile?.phone;
  const photo = user?.profile?.photo;

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Header - switches between guest and authenticated */}
      {isAuthenticated ? (
        <AuthenticatedHeader
          displayName={displayName}
          phone={phone}
          photo={photo}
          userId={firebaseUser?.uid ?? ''}
          onPhotoChange={handlePhotoChange}
        />
      ) : (
        <GuestHeader />
      )}

      {/* Menu sections */}
      <div className="px-4 pt-4 space-y-3">
        {/* Wallet - only for logged-in users */}
        {isAuthenticated && (
          <SectionCard>
            <MenuRow
              icon={<Wallet className="w-5 h-5" />}
              label="Glamour Wallet: &#x20B9;0"
              href="/customer/wallet"
              showDivider={false}
            />
          </SectionCard>
        )}

        {/* Refer & Earn */}
        <SectionCard>
          <MenuRow
            icon={<Gift className="w-5 h-5 text-orange-500" />}
            label="Refer & Earn"
            href="/referral"
            trailing={
              <div className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-semibold text-gray-500">0</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            }
            showDivider={false}
          />
          <p className="px-4 pb-3 -mt-1 text-xs text-gray-400">coins &amp; free services</p>
        </SectionCard>

        {/* Earn With Us */}
        <SectionCard>
          <div className="px-4 pt-3.5 pb-1">
            <h2 className="text-sm font-bold text-gray-900">Earn With Us</h2>
          </div>
          <MenuRow
            icon={<Briefcase className="w-5 h-5" />}
            label="Register as a Partner"
            href="/partner"
            showDivider={false}
          />
        </SectionCard>

        {/* Wanna Read Something? */}
        <SectionCard>
          <div className="px-4 pt-3.5 pb-1">
            <h2 className="text-sm font-bold text-gray-900">Wanna Read Something?</h2>
          </div>
          <MenuRow
            icon={<Globe className="w-5 h-5" />}
            label="Blog"
            href="/blog"
            showDivider={false}
          />
        </SectionCard>

        {/* Other Information */}
        <SectionCard>
          <div className="px-4 pt-3.5 pb-1">
            <h2 className="text-sm font-bold text-gray-900">Other Information</h2>
          </div>
          <MenuRow
            icon={<Share2 className="w-5 h-5" />}
            label={shareMessage ?? 'Share the App'}
            onClick={handleShareApp}
          />
          <MenuRow icon={<Info className="w-5 h-5" />} label="About Us" href="/about" />
          <MenuRow icon={<Shield className="w-5 h-5" />} label="Privacy Policy" href="/privacy" />
          <MenuRow
            icon={<FileText className="w-5 h-5" />}
            label="Terms & Conditions"
            href="/terms"
          />
          {isAuthenticated && (
            <MenuRow
              icon={<Bell className="w-5 h-5" />}
              label="Notification preferences"
              href="/customer/notifications"
            />
          )}
          <MenuRow
            icon={<Mail className="w-5 h-5" />}
            label="Contact Us"
            href="/contact"
            showDivider={false}
          />
        </SectionCard>

        {/* Sign Out + Delete Account - only for logged-in users */}
        {isAuthenticated && (
          <SectionCard>
            <MenuRow
              icon={<LogOut className="w-5 h-5 text-red-500" />}
              label="Sign Out"
              onClick={handleSignOut}
              trailing={null}
            />
            <MenuRow
              icon={<Trash2 className="w-5 h-5 text-red-500" />}
              label="Delete Account"
              href="/data-deletion"
              showDivider={false}
            />
          </SectionCard>
        )}

        {/* App version footer */}
        <div className="flex flex-col items-center py-6">
          <span className="text-sm font-semibold text-gray-400">Glamornate</span>
          <span className="text-xs text-gray-300 mt-0.5">v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
