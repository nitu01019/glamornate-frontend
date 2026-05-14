'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function HeroBanner() {
  return (
    <section className="px-4 pb-2">
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-card-md">
        <Image
          src="/images/hero/hero-banner.webp"
          alt="Luxury spa experience with premium wellness treatments"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {/* Dark gradient overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

        {/* Overlay content */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end px-6 pb-6">
          <p className="text-white/80 text-xs font-medium tracking-wide uppercase mb-1">
            Luxury Spa Experience
          </p>
          <h2 className="text-white text-2xl font-bold leading-tight mb-1">
            Premium Wellness
            <br />
            <span className="text-brand-gold-400">at Your Doorstep</span>
          </h2>
          <p className="text-white/70 text-sm mb-3">
            Rejuvenate your body and mind with expert care
          </p>
          <Link
            href="/services"
            className="inline-block bg-brand-maroon-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-maroon-600 active:scale-[0.98] transition-all"
          >
            Explore Services →
          </Link>
        </div>
      </div>
    </section>
  );
}
