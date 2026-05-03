'use client';

import { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useService } from '@/hooks/useServices';
import { useSpas } from '@/hooks/useSpas';
import { Skeleton } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Clock,
  ChevronLeft,
  MapPin,
  Star,
  Calendar,
  CheckCircle,
  Users,
  Sparkles,
} from 'lucide-react';
import type { Spa } from '@/types';

const categoryConfig: Record<
  string,
  { label: string; emoji: string; color: string; bgColor: string }
> = {
  massage: { label: 'Massage', emoji: '', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  facial: { label: 'Facial', emoji: '', color: 'text-pink-600', bgColor: 'bg-pink-50' },
  body: { label: 'Body Treatment', emoji: '', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  wellness: { label: 'Wellness', emoji: '', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  manicure: {
    label: 'Manicure',
    emoji: '',
    color: 'text-brand-maroon-500',
    bgColor: 'bg-brand-maroon-50',
  },
  pedicure: {
    label: 'Pedicure',
    emoji: '',
    color: 'text-brand-gold-600',
    bgColor: 'bg-brand-gold-50',
  },
};

function SpaCard({ spa }: { spa: Spa & { id: string } }) {
  // F6: defer `new Date()` weekday resolution to post-mount to avoid SSR/CSR drift.
  const [todayWeekday, setTodayWeekday] = useState<string | null>(null);
  useEffect(() => {
    setTodayWeekday(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase());
  }, []);

  const isOpenToday = () => {
    if (todayWeekday === null) return false;
    return spa.operatingHours?.[todayWeekday as keyof typeof spa.operatingHours]?.isOpen ?? false;
  };

  return (
    <Link
      href={`/spas/${spa.id}`}
      className="flex-shrink-0 w-64 bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
    >
      <div className="relative h-32">
        <Image
          src={
            spa.featuredImage ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              spa.name,
            )}&background=f43f5e&color=fff&size=200`
          }
          alt={spa.name}
          fill
          className="object-cover"
          sizes="256px"
        />
        <span
          className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full ${
            isOpenToday() ? 'bg-emerald-500 text-white' : 'bg-gray-600 text-white'
          }`}
        >
          {isOpenToday() ? 'Open' : 'Closed'}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 truncate">{spa.name}</h3>
        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
          <MapPin className="w-3.5 h-3.5" />
          <span className="truncate">{spa.location?.city}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-brand-gold-400 fill-brand-gold-400" />
            <span className="text-sm font-medium text-gray-900">
              {spa.rating?.overall?.toFixed(1) || 'N/A'}
            </span>
          </div>
          {spa.tier === 'premium' && (
            <span className="px-2 py-0.5 bg-brand-gold-100 text-brand-gold-700 text-xs font-medium rounded-full">
              PREMIUM
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ServiceDetailClientPage({ id }: { id: string }) {
  const router = useRouter();

  const {
    data: service,
    isLoading: serviceLoading,
    error: serviceError,
    refetch: refetchService,
  } = useService(id);
  const {
    data: allSpas = [],
    isLoading: spasLoading,
    error: spasError,
    refetch: refetchSpas,
  } = useSpas({ isActive: true });

  const relatedSpas = allSpas.filter(
    (spa) => service?.category && spa.categories?.includes(service.category),
  );

  if (serviceLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-28">
        {/* Header skeleton */}
        <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
          <div className="flex items-center h-14 px-4">
            <div className="w-10 h-10 flex items-center justify-center -ml-2">
              <Skeleton className="w-6 h-6 rounded" />
            </div>
            <div className="flex-1 flex justify-center px-4">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="w-10" />
          </div>
        </header>

        {/* Hero skeleton */}
        <div className="bg-gray-100 py-12 px-5 flex flex-col items-center">
          <Skeleton className="w-16 h-16 rounded-full mb-4" />
          <Skeleton className="h-6 w-24 rounded-full mb-3" />
          <Skeleton className="h-7 w-48 mb-2" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="p-5 space-y-6">
          {/* Duration badge skeleton */}
          <div className="bg-white rounded-2xl p-4">
            <Skeleton className="h-5 w-40 mb-3" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
          </div>

          {/* Description skeleton */}
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Available at spas skeleton */}
          <div>
            <Skeleton className="h-5 w-44 mb-4" />
            <div className="flex gap-4 overflow-hidden pb-2 -mx-5 px-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-64 bg-white rounded-2xl overflow-hidden shadow-sm"
                >
                  <Skeleton className="h-32 w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (serviceError) {
    return (
      <div className="min-h-screen bg-gray-50 p-5">
        <ErrorState
          title="Failed to load service"
          message="We couldn't load the service details."
          showRetry
          onRetry={() => refetchService()}
        />
      </div>
    );
  }

  if (!service) {
    notFound();
  }

  const config = categoryConfig[service.category] || {
    label: 'Service',
    emoji: '',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center -ml-2"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-gray-900 truncate px-4">
            Service Details
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Hero */}
      <div className={`${config.bgColor} py-12 px-5 text-center`}>
        <div className="text-6xl mb-4">{service.icon || config.emoji}</div>
        <span
          className={`inline-block px-3 py-1 ${config.bgColor} ${config.color} text-sm font-medium rounded-full mb-3 border border-current/10`}
        >
          {config.label}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{service.name}</h1>
        <div className="flex items-center justify-center gap-4 text-gray-600">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {service.baseDuration} min
          </span>
          <span className="text-2xl font-bold text-brand-maroon-500">
            ₹{service.basePrice?.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-6">
        {/* Duration Variants */}
        {service.durationVariants && service.durationVariants.length > 1 && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Available Durations</h3>
            <div className="flex flex-wrap gap-2">
              {service.durationVariants.map((duration) => (
                <span
                  key={duration}
                  className="px-4 py-2 bg-brand-maroon-50 text-brand-maroon-600 text-sm font-medium rounded-xl"
                >
                  {duration} min
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="bg-white rounded-2xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">About this Service</h3>
          <p className="text-gray-600 leading-relaxed">
            {service.description ||
              'Experience our premium service designed to rejuvenate and relax.'}
          </p>
        </div>

        {/* Benefits */}
        {service.benefits && service.benefits.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Benefits</h3>
            <div className="space-y-2">
              {service.benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended For */}
        {service.recommendedFor && service.recommendedFor !== 'all' && (
          <div className="bg-brand-gold-50 rounded-2xl p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-gold-600" />
            <span className="text-brand-gold-800 font-medium">
              Recommended for {service.recommendedFor}
            </span>
          </div>
        )}

        {/* Add-ons */}
        {service.addOns && service.addOns.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Available Add-ons</h3>
            <div className="space-y-3">
              {service.addOns.map((addon, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">{addon.name}</p>
                    <p className="text-sm text-gray-500">+{addon.duration} min</p>
                  </div>
                  <span className="font-semibold text-brand-maroon-500">+₹{addon.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {service.tags && service.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {service.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 bg-white text-gray-600 text-sm rounded-full border border-gray-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Available at Spas */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Available at These Spas</h3>
          {spasError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 my-4">
              <p className="text-sm text-red-700">
                Unable to load related spas.{' '}
                <button onClick={() => refetchSpas()} className="font-semibold underline">
                  Try again
                </button>
              </p>
            </div>
          ) : spasLoading ? (
            <div className="flex gap-4 overflow-hidden pb-2 -mx-5 px-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-64 bg-white rounded-2xl overflow-hidden shadow-sm"
                >
                  <Skeleton className="h-32 w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : relatedSpas.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5">
              {relatedSpas.slice(0, 10).map((spa) => (
                <SpaCard key={spa.id} spa={spa} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-2xl">
              <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No spas found for this service.</p>
              <Link
                href="/spas"
                className="text-brand-maroon-500 font-medium text-sm mt-2 inline-block"
              >
                Browse all spas
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 safe-area-inset-bottom">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500">Starting from</p>
            <p className="text-xl font-bold text-gray-900">
              ₹{service.basePrice?.toLocaleString()}
            </p>
          </div>
          <Link
            href="/customer/book-new"
            className="flex-1 max-w-[200px] h-14 bg-gradient-to-r from-brand-maroon-500 to-brand-maroon-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Calendar className="w-5 h-5" />
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}
