'use client';

/**
 * Account-linking landing page.
 *
 * Phase 4 (Booking Flow Fix v3.1, 2026-05-02, Patch DR-2): the empty
 * bookings list surfaces an "Looking for older bookings?" banner that
 * deep-links here. The page sets the warm context (you may have signed
 * in two ways, that's fine, here's how to merge), then either guides the
 * customer to a self-serve link (Google + phone) or to support (cross-
 * provider merges that need an admin callable).
 */
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { LINK_ACCOUNTS_TITLE, LINK_ACCOUNTS_BODY } from '@/lib/booking/copy';

function AccountLinkContent() {
  return (
    <div className="min-h-screen bg-gray-50 px-5 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">{LINK_ACCOUNTS_TITLE}</h1>
          <p className="mt-2 text-sm text-gray-600">{LINK_ACCOUNTS_BODY}</p>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-gray-900">How linking works</h2>
          <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-2">
            <li>
              Sign in with your <span className="font-medium">other</span> method (Google, phone,
              or email + password).
            </li>
            <li>We&apos;ll detect that the same email or phone is already on this account.</li>
            <li>
              Confirm the link, and bookings under the second method become visible under your
              primary login.
            </li>
          </ol>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Still missing bookings?</h2>
          <p className="text-sm text-gray-600">
            If your bookings were created on a fully separate account (different email and
            phone), our team can merge them for you. Reply to your booking-confirmation email or
            visit Help.
          </p>
          <div className="flex gap-2 pt-1">
            <Link href="/help">
              <Button variant="outline">Open Help</Button>
            </Link>
            <Link href="/customer/bookings">
              <Button variant="ghost">Back to bookings</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AccountLinkPage() {
  return (
    <ProtectedRoute>
      <AccountLinkContent />
    </ProtectedRoute>
  );
}
