'use client';

import { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSpa } from '@/hooks/useSpas';
import { useSpaServices } from '@/hooks/useServices';
import { useSpaTherapists } from '@/hooks/useTherapists';
import { useReviews, useReviewStats } from '@/hooks/useReviews';
import { useAuth } from '@/lib/auth-provider';
import { useCartStore } from '@/store/cart';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import { Skeleton } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  MapPin,
  Clock,
  Star,
  Phone,
  ChevronLeft,
  Heart,
  Share2,
  User,
  Calendar,
  Loader2,
} from 'lucide-react';
import type { Spa, Service, Therapist, Review } from '@/types';

const defaultSpaImages = [
  'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&auto=format',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format',
];

// F6: `today` weekday must come from the component (post-mount) to avoid
// SSR/CSR hydration drift. These helpers accept the resolved weekday (or null
// pre-mount) as an argument instead of calling `new Date()` themselves.
function formatOperatingHours(hours: Spa['operatingHours'], today: string | null): string {
  if (!hours) return 'Hours not available';
  if (today === null) return '—';
  const todayHours = hours[today as keyof typeof hours];
  if (!todayHours?.isOpen) return 'Closed today';
  return `${todayHours.open} - ${todayHours.close}`;
}

function isOpenToday(hours: Spa['operatingHours'], today: string | null): boolean {
  if (!hours || today === null) return false;
  return hours[today as keyof typeof hours]?.isOpen ?? false;
}

function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${
            star <= Math.round(rating) ? 'text-brand-gold-400 fill-brand-gold-400' : 'text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function ServiceCard({
  service,
}: {
  service: {
    id: string;
    service?: Service & { id: string };
    priceOverride?: number;
    durationOverride?: number;
    customName?: string;
  };
}) {
  const name = service.customName || service.service?.name || 'Service';
  const price = service.priceOverride ?? service.service?.basePrice ?? 0;
  const duration = service.durationOverride ?? service.service?.baseDuration ?? 60;

  // Phase 6: "Add" now adds to the global cart and opens the drawer instead of
  // navigating to the booking flow. This keeps the user on the spa page so
  // they can stack multiple services into a single booking.
  //
  // Phase 7 (2026-05-13): we push the underlying catalog `Service.id` rather
  // than the SpaService doc id so cart.serviceId is consistent with every
  // other entry point (home, hero carousels, catalog grids). The backend's
  // SERVICE_NOT_OFFERED_BY_SPA precondition (createBooking.ts) joins
  // `spa_services/{spaId}_{serviceId}` on the catalog id, so this MUST be
  // the catalog id, not the per-spa doc id.
  const addItem = useCartStore((s) => s.addItem);
  const handleAdd = () => {
    addItem({
      serviceId: service.service?.id ?? service.id,
      serviceName: name,
      categoryName: service.service?.category ?? '',
      subcategory: '',
      price,
      duration,
      image: service.service?.images?.[0],
    });
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <h4 className="font-medium text-gray-900">{name}</h4>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{duration} min</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-gray-900">₹{price.toLocaleString()}</span>
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 bg-brand-maroon-500 text-white text-sm font-medium rounded-xl hover:bg-brand-maroon-600 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function TherapistCard({ therapist }: { therapist: Therapist & { id: string } }) {
  return (
    <div className="flex-shrink-0 w-24 text-center">
      <div className="w-16 h-16 rounded-full mx-auto mb-2 overflow-hidden bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100 flex items-center justify-center relative">
        {therapist.photo ? (
          <Image
            src={therapist.photo}
            alt={therapist.displayName || therapist.name}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <User className="w-7 h-7 text-brand-maroon-400" />
        )}
      </div>
      <p className="text-sm font-medium text-gray-900 truncate">
        {therapist.displayName || therapist.name}
      </p>
      <div className="flex items-center justify-center gap-1 mt-1">
        <Star className="w-3 h-3 text-brand-gold-400 fill-brand-gold-400" />
        <span className="text-xs text-gray-600">
          {therapist.rating?.overall?.toFixed(1) || 'N/A'}
        </span>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review & { id: string } }) {
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Recently';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100 flex items-center justify-center">
            <User className="w-5 h-5 text-brand-maroon-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Customer</p>
            <p className="text-xs text-gray-500">
              {formatDate((review as unknown as { createdAt: string }).createdAt)}
            </p>
          </div>
        </div>
        <RatingStars rating={review.rating} />
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
    </div>
  );
}

export default function SpaDetailClientPage({ id }: { id: string }) {
  const router = useRouter();
  const { user, firebaseUser, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'about' | 'services' | 'reviews' | 'gallery'>('about');
  const [isFavoriting, setIsFavoriting] = useState(false);

  // F6: defer `new Date()` weekday resolution to post-mount to avoid SSR/CSR drift.
  const [todayWeekday, setTodayWeekday] = useState<string | null>(null);
  useEffect(() => {
    setTodayWeekday(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase());
  }, []);

  const { data: spa, isLoading: spaLoading, error: spaError, refetch: refetchSpa } = useSpa(id);
  const {
    data: services = [],
    isLoading: servicesLoading,
    error: servicesError,
    refetch: refetchServices,
  } = useSpaServices(id);
  const { data: therapists = [], isLoading: therapistsLoading } = useSpaTherapists(id);
  const {
    data: reviews = [],
    isLoading: reviewsLoading,
    error: reviewsError,
    refetch: refetchReviews,
  } = useReviews(id, { limit: 10 });
  const { data: reviewStats } = useReviewStats(id);

  const isFavorited = user?.customerData?.favorites?.includes(id) || false;

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!firebaseUser?.uid) throw new Error('Not authenticated');
      const db = getFirebaseFirestore();
      const userRef = doc(db, 'users', firebaseUser.uid);
      if (isFavorited) {
        await updateDoc(userRef, { 'customerData.favorites': arrayRemove(id) });
      } else {
        await updateDoc(userRef, { 'customerData.favorites': arrayUnion(id) });
      }
    },
    onMutate: () => setIsFavoriting(true),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setIsFavoriting(false);
    },
    onError: () => setIsFavoriting(false),
  });

  if (spaLoading) {
    return (
      <div className="min-h-screen bg-white pb-24">
        {/* Hero image skeleton */}
        <Skeleton className="h-72 w-full rounded-none" />

        {/* Content card skeleton */}
        <div className="relative -mt-8 bg-white rounded-t-3xl min-h-[60vh]">
          <div className="p-5 pt-6 space-y-4">
            {/* Badge row */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            {/* Title */}
            <Skeleton className="h-7 w-3/4" />
            {/* Rating */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Location row */}
            <Skeleton className="h-4 w-56" />
            {/* Hours row */}
            <Skeleton className="h-4 w-40" />
            {/* Category pills */}
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            {/* Description lines */}
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            {/* Service list skeletons */}
            <div className="pt-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-4 border-b border-gray-100"
                >
                  <div className="flex-1 space-y-2 pr-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-9 w-16 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (spaError) {
    return (
      <div className="min-h-screen bg-gray-50 p-5">
        <ErrorState
          title="Failed to load spa"
          message="We couldn't load the spa details."
          showRetry
          onRetry={() => refetchSpa()}
        />
      </div>
    );
  }

  if (!spa) {
    notFound();
  }

  const heroImage = spa.featuredImage || spa.gallery?.[0] || defaultSpaImages[0];
  const galleryImages = spa.gallery || defaultSpaImages;
  const minPrice =
    services.length > 0
      ? Math.min(...services.map((s) => s.priceOverride ?? s.service?.basePrice ?? 0))
      : 0;

  const tabs = [
    { key: 'about', label: 'About' },
    { key: 'services', label: 'Services' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'gallery', label: 'Gallery' },
  ] as const;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Hero Image */}
      <div className="relative h-72 w-full">
        <Image
          src={heroImage}
          alt={spa.name}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

        {/* Top Navigation */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 safe-area-inset-top">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={() => toggleFavoriteMutation.mutate()}
              disabled={isFavoriting}
              className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
            >
              {isFavoriting ? (
                <Loader2 className="w-5 h-5 text-brand-maroon-500 animate-spin" />
              ) : (
                <Heart
                  className={`w-5 h-5 ${
                    isFavorited ? 'text-brand-maroon-500 fill-brand-maroon-500' : 'text-gray-700'
                  }`}
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="relative -mt-8 bg-white rounded-t-3xl min-h-[60vh]">
        <div className="p-5 pt-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {spa.tier === 'premium' && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-brand-gold-400 to-brand-gold-500 text-white text-xs font-medium rounded-full">
                    PREMIUM
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    isOpenToday(spa.operatingHours, todayWeekday)
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isOpenToday(spa.operatingHours, todayWeekday) ? 'Open' : 'Closed'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{spa.name}</h1>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1 bg-brand-gold-50 px-2 py-1 rounded-lg">
              <Star className="w-4 h-4 text-brand-gold-400 fill-brand-gold-400" />
              <span className="font-semibold text-brand-gold-700">
                {spa.rating?.overall?.toFixed(1) || '0.0'}
              </span>
            </div>
            <span className="text-gray-500 text-sm">({spa.rating?.count || 0} reviews)</span>
          </div>

          {/* Location & Hours */}
          <div className="space-y-2 mb-5">
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm">
                {spa.location?.address}, {spa.location?.city}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm">
                {formatOperatingHours(spa.operatingHours, todayWeekday)}
              </span>
            </div>
            {spa.contact?.phone && (
              <a
                href={`tel:${spa.contact.phone}`}
                className="flex items-center gap-2 text-brand-maroon-600"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">{spa.contact.phone}</span>
              </a>
            )}
          </div>

          {/* Tab Bar */}
          <div className="flex gap-2 border-b border-gray-100 -mx-5 px-5 mb-5 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key ? 'text-brand-maroon-500' : 'text-gray-500'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-maroon-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              {spa.description && (
                <p className="text-gray-600 leading-relaxed">{spa.description}</p>
              )}

              {spa.categories && spa.categories.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Services Offered</h3>
                  <div className="flex flex-wrap gap-2">
                    {spa.categories.map((category) => (
                      <span
                        key={category}
                        className="px-3 py-1.5 bg-brand-maroon-50 text-brand-maroon-600 text-sm rounded-full capitalize"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {therapists.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Our Therapists</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5">
                    {therapistsLoading ? (
                      <div className="flex gap-4 py-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex-shrink-0 w-24 flex flex-col items-center">
                            <Skeleton className="w-16 h-16 rounded-full mb-2" />
                            <Skeleton className="h-3 w-14" />
                            <Skeleton className="h-3 w-10 mt-1" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      therapists.map((therapist) => (
                        <TherapistCard key={therapist.id} therapist={therapist} />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div>
              {servicesError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 my-4">
                  <p className="text-sm text-red-700">
                    Unable to load services.{' '}
                    <button onClick={() => refetchServices()} className="font-semibold underline">
                      Try again
                    </button>
                  </p>
                </div>
              ) : servicesLoading ? (
                <div className="space-y-0">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-4 border-b border-gray-100"
                    >
                      <div className="flex-1 space-y-2 pr-4">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-9 w-16 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : services.length > 0 ? (
                <div>
                  {services.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No services available yet.</div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div>
              {reviewsError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 my-4">
                  <p className="text-sm text-red-700">
                    Unable to load reviews.{' '}
                    <button onClick={() => refetchReviews()} className="font-semibold underline">
                      Try again
                    </button>
                  </p>
                </div>
              ) : (
                <>
                  {reviewStats && (
                    <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-2xl">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">
                          {reviewStats.average.toFixed(1)}
                        </div>
                        <RatingStars rating={reviewStats.average} size="lg" />
                        <div className="text-sm text-gray-500 mt-1">
                          {reviewStats.total} reviews
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        {[5, 4, 3, 2, 1].map((star) => (
                          <div key={star} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-3">{star}</span>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-gold-400 rounded-full"
                                style={{
                                  width: `${
                                    reviewStats.total > 0
                                      ? (reviewStats.distribution[star] / reviewStats.total) * 100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {reviewsLoading ? (
                    <div className="space-y-0">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="py-4 border-b border-gray-100 space-y-2">
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      ))}
                    </div>
                  ) : reviews.length > 0 ? (
                    <div>
                      {reviews.map((review) => (
                        <ReviewCard key={review.id} review={review} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No reviews yet. Be the first to review!
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'gallery' &&
            (galleryImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {galleryImages.map((img, idx) => (
                  <div
                    key={idx}
                    className={`relative rounded-xl overflow-hidden ${
                      idx === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${spa.name} ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-maroon-50 mb-4">
                  <Star className="w-7 h-7 text-brand-maroon-300" />
                </div>
                <p className="text-sm text-gray-500">No gallery images available for this spa.</p>
              </div>
            ))}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 safe-area-inset-bottom">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500">Starting from</p>
            <p className="text-xl font-bold text-gray-900">₹{minPrice.toLocaleString()}</p>
          </div>
          <Link
            href={`/customer/book-new?spa=${id}`}
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
