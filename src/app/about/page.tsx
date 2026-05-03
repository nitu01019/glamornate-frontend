'use client'

import Link from 'next/link'
import {
  Sparkles,
  Heart,
  Shield,
  Clock,
  MapPin,
  Star,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STATS = [
  { value: '500+', label: 'Happy Customers' },
  { value: '50+', label: 'Partner Spas' },
  { value: '10+', label: 'Cities' },
  { value: '4.8', label: 'Average Rating' },
] as const

const DIFFERENTIATORS = [
  {
    icon: Shield,
    title: 'Verified Professionals',
    description:
      'Every therapist is certified and background-verified for your safety',
  },
  {
    icon: Clock,
    title: 'Easy Booking',
    description:
      'Book in under 60 seconds. Choose your time, therapist, and service',
  },
  {
    icon: MapPin,
    title: 'Home & Salon',
    description:
      'Get premium services at home or visit our partner salons',
  },
  {
    icon: Star,
    title: 'Quality Guaranteed',
    description:
      "Not satisfied? We'll make it right or refund your money",
  },
] as const

const STORY_PARAGRAPHS = [
  "Glamornate was born from a simple frustration \u2014 finding a reliable, quality spa experience shouldn't be this hard. Whether it was inconsistent service quality, opaque pricing, or the hassle of last-minute booking, we knew there had to be a better way.",
  'Founded in 2024, we set out to build a platform that puts trust and transparency at the center of every wellness experience. We partner with only the best spas and independent therapists, ensuring every service meets our quality standards.',
  'Today, Glamornate serves customers across India with premium spa, massage, facial, and beauty services \u2014 both at home and at partner salons.',
] as const

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* ---- Hero Section ---- */}
      <div className="relative bg-gradient-to-br from-brand-maroon-500 to-brand-maroon-700 pt-14 pb-16 px-6 text-center text-white rounded-b-3xl">
        <div className="flex justify-center mb-3">
          <Sparkles className="w-8 h-8 text-brand-gold-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">About Glamornate</h1>
        <p className="text-sm text-white/80 max-w-xs mx-auto leading-relaxed">
          Redefining how India experiences wellness and beauty
        </p>
      </div>

      {/* ---- Mission Card (overlapping hero) ---- */}
      <div className="-mt-6 mx-4">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-maroon-50">
              <Heart className="w-4 h-4 text-brand-maroon-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Our Mission</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            We&apos;re building India&apos;s most trusted wellness platform
            &mdash; connecting you with premium spa experiences at your doorstep
            or at the finest salons near you. Every service is vetted, every
            therapist is certified, every booking is seamless.
          </p>
        </div>
      </div>

      {/* ---- Stats Section ---- */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-2 gap-3">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl shadow-sm p-4 text-center"
            >
              <p className="text-2xl font-bold text-brand-maroon-600">
                {stat.value}
              </p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---- What Sets Us Apart ---- */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            What sets us apart
          </h2>
          <div className="space-y-5">
            {DIFFERENTIATORS.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-brand-maroon-50">
                    <Icon className="w-5 h-5 text-brand-maroon-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ---- Our Story ---- */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Our Story</h2>
          <div className="space-y-3">
            {STORY_PARAGRAPHS.map((paragraph, idx) => (
              <p
                key={idx}
                className="text-sm text-gray-600 leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Join Us CTA ---- */}
      <div className="px-4 mt-6">
        <div className="bg-gradient-to-br from-brand-maroon-500 to-brand-gold-500 rounded-2xl shadow-sm p-6 text-center">
          <h2 className="text-lg font-bold text-white mb-2">
            Join the Glamornate family
          </h2>
          <p className="text-sm text-white/80 mb-5 leading-relaxed">
            Whether you&apos;re a customer looking for premium wellness or a spa
            wanting to grow your business
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/services"
              className="bg-white text-brand-maroon-600 text-sm font-semibold px-5 py-2.5 rounded-xl active:scale-[0.98] transition-transform"
            >
              Book a Service
            </Link>
            <Link
              href="/partner"
              className="bg-white text-brand-maroon-600 text-sm font-semibold px-5 py-2.5 rounded-xl active:scale-[0.98] transition-transform"
            >
              Become a Partner
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
