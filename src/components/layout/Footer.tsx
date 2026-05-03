'use client';

import Link from 'next/link';
import { Sparkles, Instagram, Facebook, Twitter, Mail, Phone, MapPin } from 'lucide-react';
import { useHasMounted } from '@/hooks/useHasMounted';

// =============================================================================
// Types
// =============================================================================

interface FooterProps {
  variant?: 'public' | 'minimal';
}

// =============================================================================
// Link Data
// =============================================================================

const companyLinks = [
  { href: '/about', label: 'About Us' },
  { href: '/careers', label: 'Careers' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
] as const;

const customerLinks = [
  { href: '/spas', label: 'Find Spas' },
  { href: '/services', label: 'Services' },
  { href: '/customer/bookings', label: 'My Bookings' },
  { href: '/customer/elite', label: 'Elite Membership' },
] as const;

const partnerLinks = [
  { href: '/partner/register', label: 'List Your Spa' },
  { href: '/partner/benefits', label: 'Partner Benefits' },
  { href: '/partner/support', label: 'Partner Support' },
] as const;

const legalLinks = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/data-deletion', label: 'Delete Account' },
  { href: '/refund-policy', label: 'Refund Policy' },
] as const;

const socialLinks = [
  { href: 'https://instagram.com/glamornate', label: 'Instagram', Icon: Instagram },
  { href: 'https://facebook.com/glamornate', label: 'Facebook', Icon: Facebook },
  { href: 'https://twitter.com/glamornate', label: 'Twitter', Icon: Twitter },
] as const;

// =============================================================================
// Component
// =============================================================================

export default function Footer({ variant = 'public' }: FooterProps) {
  // Defer `new Date()` to after hydration so SSR/CSR render the same HTML.
  // Server renders an empty year placeholder; the client fills it in post-mount.
  const mounted = useHasMounted();
  const currentYear = mounted ? new Date().getFullYear() : '';

  // Minimal variant for admin / dashboard pages
  if (variant === 'minimal') {
    return (
      <footer className="border-t border-gray-100 bg-white py-6">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>
            &copy; {currentYear} Glamornate. All rights reserved.
          </span>
          <div className="flex gap-4">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-brand-maroon-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    );
  }

  // Full public footer
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main footer grid */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
            <Link href="/" className="flex items-center gap-2 group mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-gold-400 to-brand-maroon-500 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-serif font-semibold text-white">Glamornate</span>
            </Link>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
              Premium spa and wellness bookings. Discover, book, and relax with the best spas near
              you.
            </p>

            {/* Contact info */}
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-brand-gold-400 flex-shrink-0" />
                <a
                  href="mailto:support@glamornate.com"
                  className="hover:text-white transition-colors"
                >
                  support@glamornate.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-brand-gold-400 flex-shrink-0" />
                <a href="tel:+911234567890" className="hover:text-white transition-colors">
                  +91 12345 67890
                </a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-gold-400 flex-shrink-0" />
                <span>Jammu, India</span>
              </div>
            </div>
          </div>

          {/* Company links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-brand-gold-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              For Customers
            </h3>
            <ul className="space-y-3">
              {customerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-brand-gold-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Partner links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              For Partners
            </h3>
            <ul className="space-y-3">
              {partnerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-brand-gold-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-gray-500">
            <span>
              &copy; {currentYear} Glamornate. All rights reserved.
            </span>
            <div className="flex gap-4">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-gray-300 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="p-2 rounded-full bg-gray-800 text-gray-400 hover:bg-brand-maroon-500 hover:text-white transition-all"
              >
                <social.Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
