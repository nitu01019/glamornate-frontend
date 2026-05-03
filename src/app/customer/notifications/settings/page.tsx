'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import {
  Bell,
  ChevronLeft,
  Mail,
  Smartphone,
  Shield,
  CreditCard,
  Loader2,
  Tag,
  Newspaper,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { useToastActions } from '@/lib/providers';
import { Skeleton } from '@/components/ui/LoadingState';
import { logger } from '@/lib/logger';

// ============================================================================
// Toggle Component
// ============================================================================

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ enabled, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`
        relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer
        rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-brand-maroon-500 focus-visible:ring-offset-2
        ${enabled ? 'bg-brand-maroon-500' : 'bg-gray-200'}
      `}
      style={{ minWidth: '48px', minHeight: '28px' }}
    >
      <span
        className={`
          pointer-events-none inline-block h-6 w-6
          transform rounded-full bg-white shadow-sm
          ring-0 transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// ============================================================================
// Toggle Row Component
// ============================================================================

interface ToggleRowProps {
  icon: React.ElementType;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  isLast?: boolean;
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  enabled,
  onChange,
  isLast = false,
}: ToggleRowProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-4 ${
        isLast ? '' : 'border-b border-gray-100'
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0 mr-3">
        <Icon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

// ============================================================================
// Section Card Component
// ============================================================================

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-gray-500 px-1 mb-2 uppercase tracking-wider">
        {title}
      </h2>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">{children}</div>
    </div>
  );
}

// ============================================================================
// Skeleton Loader
// ============================================================================

function NotificationsSkeleton() {
  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Header skeleton */}
      <div className="bg-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      </div>

      {/* Sections skeleton */}
      <div className="px-4 pt-6">
        {[1, 2, 3].map((section) => (
          <div key={section} className="mb-6">
            <Skeleton className="h-4 w-32 mb-2 ml-1" />
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between px-4 py-4 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <Skeleton className="w-5 h-5 rounded mt-0.5" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-36 mb-1" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                  <Skeleton className="w-12 h-7 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Notification Preferences State
// ============================================================================

interface NotificationPrefs {
  // Booking Updates
  bookingPush: boolean;
  bookingEmail: boolean;
  // M-NOTIFY: SMS Alerts toggle removed 2026-04-25 — Twilio retired.
  // Promotions & Offers
  promoPush: boolean;
  promoEmail: boolean;
  // Account & Security
  loginAlerts: boolean;
  paymentUpdates: boolean;
}

function getInitialPrefs(
  userNotifications?: { email: boolean; push: boolean; sms: boolean },
  granularPrefs?: Partial<NotificationPrefs>,
): NotificationPrefs {
  // If granular prefs were saved previously, use them directly
  if (granularPrefs && Object.keys(granularPrefs).length > 0) {
    return {
      bookingPush: granularPrefs.bookingPush ?? true,
      bookingEmail: granularPrefs.bookingEmail ?? true,
      promoPush: granularPrefs.promoPush ?? true,
      promoEmail: granularPrefs.promoEmail ?? true,
      loginAlerts: granularPrefs.loginAlerts ?? true,
      paymentUpdates: granularPrefs.paymentUpdates ?? true,
    };
  }

  // Fallback: derive from top-level flags
  const email = userNotifications?.email ?? true;
  const push = userNotifications?.push ?? true;

  return {
    bookingPush: push,
    bookingEmail: email,
    promoPush: push,
    promoEmail: email,
    loginAlerts: true,
    paymentUpdates: true,
  };
}

function hasChanges(current: NotificationPrefs, initial: NotificationPrefs): boolean {
  return (Object.keys(current) as Array<keyof NotificationPrefs>).some(
    (key) => current[key] !== initial[key],
  );
}

// ============================================================================
// Page Content
// ============================================================================

function NotificationsContent() {
  const router = useRouter();
  const { user, firebaseUser, refreshUser, isLoading: authLoading } = useAuth();
  const toast = useToastActions();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `notificationPrefs` is a forward-compat field not yet in the `User` schema; remove once A2 reconciliation lands the typed slot (tracked in A2-RECONCILIATION.md)
  const granular = (user?.preferences as any)?.notificationPrefs as
    | Partial<NotificationPrefs>
    | undefined;
  const [prefs, setPrefs] = useState<NotificationPrefs>(() =>
    getInitialPrefs(user?.preferences?.notifications, granular),
  );
  const [initialPrefs, setInitialPrefs] = useState<NotificationPrefs>(() =>
    getInitialPrefs(user?.preferences?.notifications, granular),
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when user data loads or changes
  useEffect(() => {
    if (user?.preferences?.notifications) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same rationale as above: forward-compat `notificationPrefs` not yet in typed `User.preferences`
      const savedGranular = (user.preferences as any)?.notificationPrefs as
        | Partial<NotificationPrefs>
        | undefined;
      const freshPrefs = getInitialPrefs(user.preferences.notifications, savedGranular);
      setPrefs(freshPrefs);
      setInitialPrefs(freshPrefs);
    }
  }, [user?.preferences?.notifications, user?.preferences]);

  const isDirty = hasChanges(prefs, initialPrefs);

  const updatePref = useCallback(
    <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
      setPrefs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = async () => {
    if (!firebaseUser?.uid || !isDirty) return;

    setIsSaving(true);
    try {
      const db = getFirebaseFirestore();
      const userRef = doc(db, 'users', firebaseUser.uid);

      // Persist both top-level flags and granular prefs
      const notificationUpdate = {
        email: prefs.bookingEmail || prefs.promoEmail,
        push: prefs.bookingPush || prefs.promoPush,
      };

      await updateDoc(userRef, {
        'preferences.notifications': notificationUpdate,
        'preferences.notificationPrefs': {
          bookingPush: prefs.bookingPush,
          bookingEmail: prefs.bookingEmail,
          promoPush: prefs.promoPush,
          promoEmail: prefs.promoEmail,
          loginAlerts: prefs.loginAlerts,
          paymentUpdates: prefs.paymentUpdates,
        },
        updatedAt: serverTimestamp(),
      });

      await refreshUser();
      setInitialPrefs({ ...prefs });
      toast.success('Preferences saved', 'Your notification settings have been updated.');
    } catch (error: unknown) {
      logger.error('Failed to save notification preferences', error, {
        component: 'customer/notifications',
      });
      toast.error('Failed to save', 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return <NotificationsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-white">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="font-bold text-gray-900">Notifications</h1>
          </div>
          <div className="w-10" />
        </div>

        <div className="px-4 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-maroon-50 flex items-center justify-center">
              <Bell className="w-5 h-5 text-brand-maroon-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
              <p className="text-sm text-gray-500">Manage how you receive updates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 pt-6">
        {/* Booking Updates */}
        <SectionCard title="Booking Updates">
          <ToggleRow
            icon={Smartphone}
            title="Push Notifications"
            description="Get notified about booking confirmations and reminders"
            enabled={prefs.bookingPush}
            onChange={(v) => updatePref('bookingPush', v)}
          />
          <ToggleRow
            icon={Mail}
            title="Email Updates"
            description="Receive booking details and receipts via email"
            enabled={prefs.bookingEmail}
            onChange={(v) => updatePref('bookingEmail', v)}
            isLast
          />
        </SectionCard>

        {/* Promotions & Offers */}
        <SectionCard title="Promotions & Offers">
          <ToggleRow
            icon={Tag}
            title="Push Notifications"
            description="Special deals and limited-time offers"
            enabled={prefs.promoPush}
            onChange={(v) => updatePref('promoPush', v)}
          />
          <ToggleRow
            icon={Newspaper}
            title="Email Newsletter"
            description="Weekly beauty tips and exclusive promotions"
            enabled={prefs.promoEmail}
            onChange={(v) => updatePref('promoEmail', v)}
            isLast
          />
        </SectionCard>

        {/* Account & Security */}
        <SectionCard title="Account & Security">
          <ToggleRow
            icon={Shield}
            title="Login Alerts"
            description="Get notified of new sign-ins to your account"
            enabled={prefs.loginAlerts}
            onChange={(v) => updatePref('loginAlerts', v)}
          />
          <ToggleRow
            icon={CreditCard}
            title="Payment Updates"
            description="Notifications about payments and refunds"
            enabled={prefs.paymentUpdates}
            onChange={(v) => updatePref('paymentUpdates', v)}
            isLast
          />
        </SectionCard>

        {/* Unsaved changes indicator */}
        {isDirty && (
          <p className="text-center text-sm text-brand-maroon-500 font-medium mb-3 animate-fade-in">
            You have unsaved changes
          </p>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className={`
            w-full py-3.5 rounded-xl text-white font-semibold text-base
            transition-all duration-200
            ${
              isDirty && !isSaving
                ? 'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 active:scale-[0.98] shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function NotificationsPage() {
  return <NotificationsContent />;
}
