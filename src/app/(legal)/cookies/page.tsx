import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookies & Local Storage',
  description:
    'What Glamornate stores on your device and why. Plain-English notice with no trackers of our own.',
  robots: { index: true, follow: true },
};

const LAST_UPDATED = '2026-04-20';

interface CookieEntry {
  readonly name: string;
  readonly purpose: string;
  readonly scope: 'localStorage' | 'sessionStorage' | 'cookie' | 'indexedDB';
  readonly lifetime: string;
}

const COOKIE_ENTRIES: readonly CookieEntry[] = [
  {
    name: 'firebaseAuthSession',
    purpose: 'Keeps you signed in. Required for bookings.',
    scope: 'indexedDB',
    lifetime: 'Until you sign out',
  },
  {
    name: 'glamornate-cart',
    purpose: 'Saves the spa services in your cart so you do not lose them on refresh.',
    scope: 'localStorage',
    lifetime: 'Until you clear it or sign out',
  },
  {
    name: 'glamornate_user_location',
    purpose:
      'Remembers the location you chose so the home screen shows nearby spas.',
    scope: 'localStorage',
    lifetime: 'Until you change or clear it',
  },
  {
    name: 'rq-persist-glamornate',
    purpose:
      'Caches React Query responses so the app feels fast when you re-open it.',
    scope: 'localStorage',
    lifetime: '24 hours, then refetched',
  },
  {
    name: 'portrait-lock',
    purpose: 'Remembers your portrait-lock preference on tablets.',
    scope: 'sessionStorage',
    lifetime: 'Until you close the app',
  },
];

export default function CookiesPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-white pb-24 animate-fade-in"
    >
      <header className="border-b border-gray-100 bg-white px-5 pt-14 pb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Cookies &amp; Local Storage
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Glamornate keeps things simple. We do not use third-party advertising
          trackers. The only data we store on your device is what we need to
          keep you signed in, remember your cart, and make the app fast. This
          page lists every entry.
        </p>
      </header>

      <article className="px-5 pt-2">
        {/* The list */}
        <section aria-labelledby="list-heading" className="mt-8">
          <h2
            id="list-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            What we store
          </h2>
          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Purpose
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Where
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Lifetime
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {COOKIE_ENTRIES.map((entry) => (
                  <tr key={entry.name}>
                    <td className="px-3 py-3 font-mono text-xs">
                      {entry.name}
                    </td>
                    <td className="px-3 py-3">{entry.purpose}</td>
                    <td className="px-3 py-3">{entry.scope}</td>
                    <td className="px-3 py-3">{entry.lifetime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* What we do not use */}
        <section
          aria-labelledby="not-used-heading"
          className="mt-10 scroll-mt-24"
        >
          <h2
            id="not-used-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            What we do not use
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>
              We do not use Facebook Pixel, Google Ads conversion tags, or any
              other advertising tracker.
            </li>
            <li>
              We do not share device identifiers with data brokers.
            </li>
            <li>
              We do not set cross-site tracking cookies.
            </li>
          </ul>
        </section>

        {/* What Firebase sets */}
        <section
          aria-labelledby="firebase-heading"
          className="mt-10 scroll-mt-24"
        >
          <h2
            id="firebase-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            What our processors set
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">
            Firebase (Google LLC) may set its own identifiers in IndexedDB to
            manage your authentication session and to deliver push
            notifications. These are documented in{' '}
            <a
              href="https://firebase.google.com/support/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-maroon-600 underline"
            >
              Firebase&apos;s privacy notice
            </a>
            .
          </p>
        </section>

        {/* Controls */}
        <section
          aria-labelledby="controls-heading"
          className="mt-10 scroll-mt-24"
        >
          <h2
            id="controls-heading"
            className="text-lg font-semibold text-gray-900 mb-3"
          >
            How to clear or control these
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>
              Signing out (from the Account tab) clears your session and cart.
            </li>
            <li>
              Deleting your account (
              <Link
                href="/data-deletion"
                className="text-brand-maroon-600 underline"
              >
                see the Data Deletion page
              </Link>
              ) also clears everything on our side.
            </li>
            <li>
              Clearing your browser data or app storage removes everything
              locally. You can do this in Settings &rarr; Apps &rarr; Glamornate
              &rarr; Storage on Android.
            </li>
          </ul>
        </section>

        {/* Related */}
        <section className="mt-10">
          <p className="text-sm text-gray-600">
            For the full picture of what data we collect on the server side,
            see our{' '}
            <Link
              href="/privacy"
              className="text-brand-maroon-600 underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
          <p className="mt-4 text-xs text-gray-500">
            TODO: Add Hindi translation of this notice in a future release.
          </p>
        </section>
      </article>
    </main>
  );
}
