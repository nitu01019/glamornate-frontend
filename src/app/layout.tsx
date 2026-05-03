import './globals.css';

import type { Metadata, Viewport } from 'next';
import React from 'react';
import { Inter, Playfair_Display } from 'next/font/google';
import { Providers } from '@/lib/providers';
import ConditionalNav from '@/components/layout/ConditionalNav';
import GlobalWidgets from '@/components/layout/GlobalWidgets';
import { PrivacyScreenWatcher } from '@/components/PrivacyScreenWatcher';
import { DeepLinksInstaller } from '@/components/DeepLinksInstaller';
import { AppCheckDebugBanner } from '@/components/debug/AppCheckDebugBanner';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '600', '700'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'Glamornate - Premium Spa & Wellness Booking',
    template: '%s | Glamornate',
  },
  description:
    'Discover and book luxury spa treatments, beauty services, and wellness experiences at top-rated salons near you.',
  keywords: ['spa', 'wellness', 'massage', 'beauty', 'booking', 'luxury', 'treatments', 'salon'],
  authors: [{ name: 'Glamornate' }],
  creator: 'Glamornate',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://glamornate.com',
    siteName: 'Glamornate',
    title: 'Glamornate - Premium Spa & Wellness Booking',
    description:
      'Discover and book luxury spa treatments, beauty services, and wellness experiences at top-rated salons near you.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Glamornate - Premium Spa & Wellness Booking',
    description: 'Discover and book luxury spa treatments at top-rated spas near you.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable}`}
      // Next.js 15+: opt-in to keep `scroll-behavior: smooth` working across
      // route transitions. Without this attribute, Next disables smooth
      // scrolling on RSC navigations and emits a deprecation warning.
      data-scroll-behavior="smooth"
    >
      <body className="font-sans antialiased bg-white text-gray-900 min-h-screen">
        {/* Portrait lock overlay — CSS @media (orientation: landscape) overrides display to flex */}
        <div id="portrait-lock-overlay" style={{ display: 'none' }} aria-hidden="true">
          <svg
            className="rotate-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12" y2="18.01" />
          </svg>
          <p>Please rotate your device</p>
          <span>Glamornate works best in portrait mode</span>
        </div>

        {/* Skip to content link for accessibility */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <Providers>
          <PrivacyScreenWatcher />
          <DeepLinksInstaller />
          <ConditionalNav>{children}</ConditionalNav>
          <GlobalWidgets />
          {/* Phase 8 (Booking Flow Fix v3.1, 2026-05-02): staging-only.
              The component itself short-circuits when env flags are not
              both set, so production builds tree-shake it out. */}
          <AppCheckDebugBanner />
        </Providers>
      </body>
    </html>
  );
}
