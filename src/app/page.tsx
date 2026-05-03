import { Suspense } from 'react';
import Link from 'next/link';

import HeroBannerCarousel from '@/components/home/HeroBannerCarousel';
import HomeHeroCarousel from '@/components/home/HomeHeroCarousel';
import EliteBanner from '@/components/home/EliteBanner';
import CategoryTilesGrid from '@/components/home/CategoryTilesGrid';
import HomeCategoryGrid from '@/components/home/HomeCategoryGrid';
import HomePageClient from '@/components/home/HomePageClient';
import PromoSection from '@/components/home/PromoSection';
import BrandFooter from '@/components/home/BrandFooter';
import { isHomeV2Enabled, isHomeV2HeroEnabled } from '@/lib/flags/home-flags';
import {
  HeroBannerSkeleton,
  CategoriesGridSkeleton,
  HomeHeroCarouselSkeleton,
  HomeCategoryGridSkeleton,
  MostBookedSkeleton,
  PromoBannerSkeleton,
} from '@/components/home/HomeSkeletons';

export default function HomePage() {
  const homeV2Hero = isHomeV2HeroEnabled();
  const homeV2Grid = isHomeV2Enabled();

  return (
    <div className="min-h-screen bg-section-bg animate-fade-in">
      {/* Hero promotional banner — gated by NEXT_PUBLIC_HOME_V2_HERO */}
      {homeV2Hero ? (
        <Suspense fallback={<HomeHeroCarouselSkeleton />}>
          <HomeHeroCarousel />
        </Suspense>
      ) : (
        <Suspense fallback={<HeroBannerSkeleton />}>
          <HeroBannerCarousel />
        </Suspense>
      )}

      {/* Elite membership bar */}
      <EliteBanner />

      {/* Category tiles — gated by NEXT_PUBLIC_HOME_V2_GRID */}
      {homeV2Grid ? (
        <Suspense fallback={<HomeCategoryGridSkeleton />}>
          <HomeCategoryGrid heading="Explore all categories" />
        </Suspense>
      ) : (
        <Suspense fallback={<CategoriesGridSkeleton />}>
          <CategoryTilesGrid />
        </Suspense>
      )}

      {/* Grey divider */}
      <div className="h-2 bg-section-bg" />

      {/* Most Booked services + Cart system (client-side) */}
      <Suspense fallback={<MostBookedSkeleton />}>
        <HomePageClient />
      </Suspense>

      {/* Grey divider */}
      <div className="h-2 bg-section-bg" />

      {/* Promotional banner */}
      <div className="bg-white px-4 pt-4 pb-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Deal of the Day</h2>
          <Link
            href="/offers"
            className="text-sm font-medium text-brand-maroon-500 hover:text-brand-maroon-600 transition-colors"
          >
            See All Offers
          </Link>
        </div>
      </div>
      <Suspense fallback={<PromoBannerSkeleton />}>
        <PromoSection />
      </Suspense>

      {/* Brand credibility footer — last visible element */}
      <BrandFooter />
    </div>
  );
}
