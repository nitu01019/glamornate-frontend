import { MapPin, Heart, Instagram, Facebook, MessageCircle } from 'lucide-react';

const SOCIAL_LINKS = [
  { href: '#', icon: Instagram, label: 'Instagram' },
  { href: '#', icon: Facebook, label: 'Facebook' },
  { href: '#', icon: MessageCircle, label: 'WhatsApp' },
] as const;

export default function BrandFooter() {
  return (
    <footer>
      {/* ── Section 1 · Tricolor inline badge ─────────────────────────── */}
      <section className="bg-white py-5">
        <div className="flex items-center gap-0 px-4">
          {/* Saffron bar */}
          <div className="flex-1 h-[3px] rounded-full bg-[#FF9933]" />
          {/* Text */}
          <span className="px-4 text-sm font-bold tracking-wide text-zinc-800 whitespace-nowrap">
            100 % Purely Bhartiya Brand
          </span>
          {/* Green bar */}
          <div className="flex-1 h-[3px] rounded-full bg-[#138808]" />
        </div>
      </section>

      {/* ── Section 2 · City presence ─────────────────────────────────── */}
      <section className="bg-gray-50 pt-5 pb-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">
          We Are Live In
        </p>

        <div className="mt-2.5 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-brand-maroon-500 flex-shrink-0 -ml-6 mr-1" />
          <span className="text-2xl font-bold text-zinc-900 tracking-tight">
            Jammu
          </span>
        </div>

        <p className="mt-1.5 text-xs text-zinc-500">
          Glamornate Salon, Jammu, Jammu &amp; Kashmir
        </p>

        <p className="mt-2 text-[11px] text-zinc-400 italic">
          *More cities coming soon
        </p>
      </section>

      {/* ── Section 3 · Brand statement (frosted display text) ────────── */}
      <section className="relative bg-stone-100 py-8 overflow-hidden">
        {/* Left accent bar */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-16 rounded-full bg-brand-maroon-500" />

        {/* Large frosted text */}
        <div
          className="pl-8 pr-6"
          style={{ filter: 'blur(0.4px)' }}
        >
          <p className="text-[2rem] leading-[1.15] font-extrabold text-zinc-300 tracking-tight">
            India&apos;s Most Loved
          </p>
          <p className="text-[2rem] leading-[1.15] font-extrabold text-zinc-300 tracking-tight">
            Home Salon &amp; Spa App
          </p>
        </div>
      </section>

      {/* ── Section 4 · Crafted with love ─────────────────────────────── */}
      <section className="bg-zinc-900 pt-5 pb-4 text-center">
        <p className="text-sm text-zinc-400 flex items-center justify-center gap-1.5">
          Crafted with{' '}
          <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
          {' '}by Team Glamornate
        </p>

        <p className="mt-1.5 text-[11px] text-zinc-600">
          &copy; 2025 Glamornate. All rights reserved.
        </p>

        <div className="mt-3.5 flex items-center justify-center gap-3">
          {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
            <a
              key={label}
              href={href}
              aria-label={label}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all"
            >
              <Icon className="w-4 h-4 text-zinc-400" />
            </a>
          ))}
        </div>
      </section>
    </footer>
  );
}
