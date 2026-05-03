import type { Metadata } from 'next';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Metadata — this URL is given to Google Play Store and must be crawlable.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Delete Your Account',
  description:
    'Two ways to permanently delete your Glamornate account: inside the app in two taps, or by emailing support.',
  robots: { index: true, follow: true },
};

// ---------------------------------------------------------------------------
// Static Data
// ---------------------------------------------------------------------------

const LAST_UPDATED = '2026-04-20';
// TODO: confirm the final support email before public launch.
const SUPPORT_EMAIL = 'support@glamornate.example';
const ANDROID_APP_ID = 'com.glamornate.app';

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default function DataDeletionPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-white pb-24 animate-fade-in"
    >
      <header className="border-b border-gray-100 bg-white px-5 pt-14 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-maroon-500">
          Account Deletion
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Delete your Glamornate account
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          You can permanently delete your account and all personal data we hold
          about you. There are two ways to do this. Pick whichever is easier
          for you.
        </p>
      </header>

      <article className="px-5 pt-2">
        {/* Path A: In-app deletion */}
        <section aria-labelledby="in-app-heading" className="mt-8 scroll-mt-24">
          <h2
            id="in-app-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            Option A — Delete from inside the app
            <span className="ml-2 rounded-full bg-brand-maroon-50 px-2 py-0.5 text-xs font-medium text-brand-maroon-600">
              Fastest, 2 taps
            </span>
          </h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed text-gray-700">
            <li>
              Open the <strong>Glamornate</strong> app and make sure you are
              signed in.
            </li>
            <li>
              Tap the <strong>Account</strong> tab in the bottom navigation bar
              (Tap 1).
            </li>
            <li>
              Scroll down to the red <strong>Delete Account</strong> button and
              tap it (Tap 2). Confirm the prompt.
            </li>
          </ol>
          <p className="mt-3 text-sm text-gray-600">
            The app will sign you out immediately. Deletion is processed within
            a few minutes.
          </p>
        </section>

        {/* Path B: Web / email deletion */}
        <section aria-labelledby="web-heading" className="mt-10 scroll-mt-24">
          <h2
            id="web-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            Option B — Delete by email (if you cannot access the app)
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">
            Send an email to{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Account%20Deletion`}
              className="text-brand-maroon-600 underline"
            >
              {SUPPORT_EMAIL}
            </a>{' '}
            with:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>
              The subject line <strong>&ldquo;Account Deletion&rdquo;</strong>
            </li>
            <li>The email address or phone number you used to register</li>
            <li>The sentence &ldquo;I request permanent deletion of my account&rdquo;</li>
          </ul>
          <p className="mt-3 text-sm text-gray-700">
            We will confirm your identity, delete your account, and reply within
            30 days. If we need more time (for example, a pending refund), we
            will tell you why and give a revised timeline.
          </p>
        </section>

        {/* What gets deleted */}
        <section
          aria-labelledby="what-deleted-heading"
          className="mt-10 scroll-mt-24"
        >
          <h2
            id="what-deleted-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            What gets deleted
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>Your profile (name, email, phone, profile photo, addresses)</li>
            <li>Your bookings and booking history</li>
            <li>Your reviews and ratings</li>
            <li>Your saved favourites</li>
            <li>Your wallet balance and voucher entitlements</li>
            <li>Your notification tokens (push notifications stop immediately)</li>
            <li>Uploaded files (profile photo, review photos)</li>
            <li>Your authentication record (you cannot sign back in)</li>
          </ul>
        </section>

        {/* What is retained */}
        <section
          aria-labelledby="what-retained-heading"
          className="mt-10 scroll-mt-24"
        >
          <h2
            id="what-retained-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            What we may retain (and why)
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">
            Indian tax and accounting regulations require us to keep certain
            transaction records for up to seven years. During that time we
            retain:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>
              <strong>Invoices and GST records</strong> associated with any
              completed booking.
            </li>
            <li>
              <strong>Hashed audit log entries</strong> (timestamp, hashed
              email, hashed phone) to demonstrate the deletion took place and
              to resolve disputes.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            These records no longer identify you by name, email, or phone in
            any reversible way. They are not used for marketing, analytics, or
            product development.
          </p>
        </section>

        {/* Timing */}
        <section aria-labelledby="timing-heading" className="mt-10 scroll-mt-24">
          <h2
            id="timing-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            How long it takes
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>
              In-app deletion: typically within 5 minutes, though backup
              replicas may take up to 30 days to fully expire.
            </li>
            <li>
              Email-based deletion: we respond within 30 days.
            </li>
          </ul>
        </section>

        {/* App info for Play Store reviewer */}
        <section
          aria-labelledby="app-info-heading"
          className="mt-10 scroll-mt-24 rounded-2xl bg-gray-50 p-4"
        >
          <h2
            id="app-info-heading"
            className="text-sm font-semibold uppercase tracking-wider text-gray-700"
          >
            App information
          </h2>
          <dl className="mt-2 space-y-1 text-sm text-gray-600">
            <div>
              <dt className="inline font-medium">App name: </dt>
              <dd className="inline">Glamornate</dd>
            </div>
            <div>
              <dt className="inline font-medium">Android application ID: </dt>
              <dd className="inline font-mono text-xs">{ANDROID_APP_ID}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Developer contact: </dt>
              <dd className="inline">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-brand-maroon-600 underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        {/* Related links */}
        <section className="mt-10">
          <p className="text-sm text-gray-600">
            Read our{' '}
            <Link
              href="/privacy"
              className="text-brand-maroon-600 underline"
            >
              Privacy Policy
            </Link>{' '}
            or our{' '}
            <Link href="/terms" className="text-brand-maroon-600 underline">
              Terms of Service
            </Link>{' '}
            for more detail.
          </p>
        </section>
      </article>
    </main>
  );
}
