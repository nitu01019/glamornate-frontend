'use client';

import Link from 'next/link';
import { BellOff, Sparkles } from 'lucide-react';

/**
 * Empty-state illustration for the notifications feed.
 *
 * Rendered when `useNotifications()` returns zero rows after loading. The
 * CTA links back to the spa browse page so the user has a clear next step
 * instead of a dead end.
 */
export default function NotificationsEmpty() {
  return (
    <section
      data-testid="notifications-empty"
      className="flex flex-col items-center justify-center px-8 py-16 text-center"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 w-24 h-24 bg-gradient-to-br from-brand-maroon-200 to-brand-gold-200 rounded-full blur-2xl opacity-50" />
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-maroon-50 to-brand-gold-50 border border-brand-maroon-100/50">
          <BellOff className="w-10 h-10 text-brand-maroon-400" aria-hidden="true" />
        </div>
        <div className="absolute -top-1 -right-1">
          <Sparkles className="w-5 h-5 text-brand-gold-400" aria-hidden="true" />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        You&apos;re all caught up
      </h2>
      <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
        New booking updates, offers, and reminders will appear here.
      </p>
      <Link
        href="/"
        className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white text-sm font-semibold shadow-md shadow-brand-maroon-200"
      >
        Explore spas
      </Link>
    </section>
  );
}
