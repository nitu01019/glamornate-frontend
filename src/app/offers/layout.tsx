import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'All Offers & Deals | Glamornate',
  description:
    'Exclusive promo codes and deal-of-the-day offers on premium spa services across partner spas on Glamornate.',
  openGraph: {
    title: 'All Offers & Deals | Glamornate',
    description:
      'Exclusive promo codes and deal-of-the-day offers on premium spa services across partner spas on Glamornate.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Offers & Deals | Glamornate',
    description:
      'Exclusive promo codes and deal-of-the-day offers on premium spa services across partner spas on Glamornate.',
  },
};

export default function OffersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
