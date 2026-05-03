'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

export default function EliteBanner() {
  const router = useRouter();

  return (
    <section className="mx-4 my-3">
      <button
        onClick={() => router.push('/customer/elite')}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-brand-maroon-950 via-brand-maroon-900 to-brand-maroon-800 text-white transition-opacity active:opacity-90"
      >
        <div className="flex items-center gap-3">
          <span className="text-brand-gold-400 font-bold italic text-lg tracking-wide">
            Elite
          </span>
          <span className="text-white/90 text-sm">
            Elite @ just <span className="font-semibold">&#8377;294</span> - only for you
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-brand-gold-400 flex-shrink-0" />
      </button>
    </section>
  );
}
