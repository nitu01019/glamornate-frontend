/**
 * Glamornate Mock Data
 * Seed data for API routes — matches design screenshots exactly.
 *
 * Categories and services are now sourced from the single-source-of-truth
 * catalog at @/data/glamornate-catalog.ts.
 */

import { catalogCategories, catalogServices } from '@/data/glamornate-catalog'

// ---------------------------------------------------------------------------
// Category types (extended for the home-page category cards)
// ---------------------------------------------------------------------------
export interface ServiceCategory {
  id: string
  name: string
  slug: string
  image: string
  serviceCount: number
  badge?: string
  ordering: number
}

// ---------------------------------------------------------------------------
// Home-page service card (extends core Service with display fields)
// ---------------------------------------------------------------------------
export interface HomeService {
  id: string
  name: string
  slug: string
  category: string
  categorySlug: string
  subcategory?: string
  description: string
  benefits: string[]
  basePrice: number
  originalPrice?: number
  discountPercent?: number
  currency: string
  duration: string
  durationMinutes: number
  image: string
  images: string[]
  isLandscapeImage?: boolean
  rating: number
  reviewCount: number
  tags: string[]
  bookingCount: number
  cities: string[]
  recommendedFor: 'all' | 'men' | 'women'
  isActive: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// Promotional banner
// ---------------------------------------------------------------------------
export type DiscountType = 'percentage' | 'flat'

export interface Promotion {
  id: string
  title: string
  subtitle: string
  description: string
  image: string
  ctaText: string
  ctaLink: string
  bgColor: string
  ordering: number
  isActive: boolean
  /** Discount type for the offers page badge */
  discountType?: DiscountType
  /** Numeric discount value (e.g. 30 for 30%, or 200 for Rs 200) */
  discountValue?: number
  /** Promo code customers can copy */
  promoCode?: string
  /** ISO date string for offer expiry */
  validUntil?: string
}

// ---------------------------------------------------------------------------
// Categories (sourced from CATALOG.md via glamornate-catalog.ts)
// ---------------------------------------------------------------------------
export const categories: ServiceCategory[] = catalogCategories

// ---------------------------------------------------------------------------
// Services (sourced from CATALOG.md via glamornate-catalog.ts — 209 services)
// ---------------------------------------------------------------------------
export const services: HomeService[] = catalogServices

// ---------------------------------------------------------------------------
// Promotions (from design screenshots)
// ---------------------------------------------------------------------------
export const promotions: Promotion[] = [
  {
    id: 'promo-01',
    title: 'HydraGlo Facial',
    subtitle: 'Time to Upgrade Your Facial Experience',
    description:
      'Deep Hydration with HydraGlo Facial -- advanced hydrafacial technology for glowing, youthful skin.',
    image: '/images/promotions/hydraglo-banner.webp',
    ctaText: 'Book Now',
    ctaLink: '/services?category=hydraglo-facials',
    bgColor: '#E8F5E9',
    ordering: 1,
    isActive: true,
    discountType: 'percentage',
    discountValue: 30,
    promoCode: 'HYDRA30',
    validUntil: '2026-05-31T23:59:59Z',
  },
  {
    id: 'promo-02',
    title: 'Full Body Korean Spa Ritual',
    subtitle: "India's 1st Ever Full Body Korean Spa Ritual",
    description:
      "India's 1st Ever Full Body Korean Spa Ritual with sensory healing techniques & 8 free gifts. A luxurious head-to-toe Korean spa experience.",
    image: '/images/promotions/korean-spa-banner.webp',
    ctaText: 'Explore',
    ctaLink: '/services?category=spa-for-women',
    bgColor: '#FFF3E0',
    ordering: 2,
    isActive: true,
    discountType: 'flat',
    discountValue: 500,
    promoCode: 'KOREAN500',
    validUntil: '2026-06-15T23:59:59Z',
  },
  {
    id: 'promo-03',
    title: 'Bridal Season Special',
    subtitle: 'Get Wedding Ready with Glamornate',
    description:
      'Complete bridal packages starting at Rs 4,999. Book 2 sessions, get 3rd free. Limited period offer.',
    image: '/images/promotions/bridal-banner.webp',
    ctaText: 'View Packages',
    ctaLink: '/services?category=pre-bridal-packages',
    bgColor: '#FCE4EC',
    ordering: 3,
    isActive: true,
    discountType: 'percentage',
    discountValue: 25,
    promoCode: 'BRIDAL25',
    validUntil: '2026-07-31T23:59:59Z',
  },
  {
    id: 'promo-04',
    title: 'Summer Glow Package',
    subtitle: 'Beat the Heat with Premium Care',
    description:
      'Get a full body de-tan, facial, and hair spa combo at an unbeatable price. Perfect for the summer season.',
    image: '/images/promotions/summer-glow-banner.webp',
    ctaText: 'Book Now',
    ctaLink: '/services?category=spa-for-women',
    bgColor: '#FFF8E1',
    ordering: 4,
    isActive: true,
    discountType: 'flat',
    discountValue: 200,
    promoCode: 'SUMMER200',
    validUntil: '2026-06-30T23:59:59Z',
  },
]
