# PRD Section 6 -- Overall Page Architecture, Component Map, and Implementation Roadmap

> **Document**: Glamornate Landing Page Redesign -- Section 6 of 6  
> **Version**: 1.0  
> **Date**: 2026-04-10  
> **Status**: Final  
> **Depends on**: Sections 1--5 of the Glamornate Landing Page PRD

---

## Table of Contents

1. [Page Architecture](#1-page-architecture)
2. [Component Map](#2-component-map)
3. [Video Asset Requirements](#3-video-asset-requirements)
4. [Image Asset Requirements](#4-image-asset-requirements)
5. [Migration Plan](#5-migration-plan)
6. [Performance Budget](#6-performance-budget)
7. [Implementation Sprints](#7-implementation-sprints)
8. [Testing Checklist](#8-testing-checklist)

---

## 1. Page Architecture

### 1.1 Route Structure

The new landing page replaces the current homepage at `/`. The existing mobile-app-style homepage (currently at `/src/app/page.tsx`) will be preserved and relocated using Next.js route groups so that authenticated users continue to see it.

```
/                          --> Landing page (unauthenticated visitors)
/                          --> App homepage  (authenticated users, route group swap)
/services/[slug]           --> Unchanged
/booking                   --> Unchanged
/cart                      --> Unchanged
/auth/*                    --> Unchanged
/customer/*                --> Unchanged
/offers                    --> Unchanged
/about, /contact, /blog    --> Unchanged
/help, /terms, /privacy    --> Unchanged
/partner, /referral        --> Unchanged
```

### 1.2 Section Order (Top to Bottom)

The landing page renders the following sections in a single scrollable page. Each section maps back to the PRD section that defines its design and behavior.

| Order | Section              | PRD Ref   | Component                  |
|-------|----------------------|-----------|----------------------------|
| --    | Sticky Navigation    | Sec. 1    | `StickyNav`                |
| 1     | Hero Video Carousel  | Sec. 1    | `HeroVideoCarousel`        |
| 2     | Milestones/Stats Bar | Sec. 2    | `StatsCounter`             |
| 3     | Services Showcase    | Sec. 2    | `ServiceShowcase`          |
| 4     | Promotional Banners  | Sec. 3    | `PromoBanners`             |
| 5     | Brand Story + Video  | Sec. 3    | `BrandStory`               |
| 6     | Trust Badges         | Sec. 4    | `TrustBadges`              |
| 7     | Customer Reviews     | Sec. 4    | `ReviewsCarousel`          |
| 8     | Booking CTA          | Sec. 5    | `BookingCTA`               |
| 9     | FAQ Accordion        | Sec. 5    | `FAQAccordion`             |
| 10    | SEO Content          | Sec. 5    | `SEOContent`               |
| 11    | Footer               | Sec. 5    | `LandingFooter`            |

### 1.3 Floating Elements

Two persistent floating elements are anchored to the viewport:

| Element          | Position                           | z-index | Behavior                                    |
|------------------|------------------------------------|---------|---------------------------------------------|
| WhatsApp Button  | Bottom-right, 24px from edges      | 40      | Always visible. Opens WhatsApp deeplink.     |
| Back to Top      | Bottom-right, stacked above WhatsApp (80px from bottom) | 40 | Hidden until user scrolls past 600px. Smooth-scrolls to top on click. |

Both floating elements should fade in/out with a 200ms transition and respect `prefers-reduced-motion` by disabling the fade animation.

### 1.4 Page-Level Markup

```tsx
// /src/app/(landing)/page.tsx -- simplified structure
<>
  <StickyNav />
  <main>
    <HeroVideoCarousel />
    <StatsCounter />
    <ServiceShowcase />
    <PromoBanners />
    <BrandStory />
    <TrustBadges />
    <ReviewsCarousel />
    <BookingCTA />
    <FAQAccordion />
    <SEOContent />
    <LandingFooter />
  </main>
  <WhatsAppButton />
  <BackToTop />
</>
```

Each `<section>` element inside its component should carry:
- A unique `id` attribute for anchor navigation (e.g., `id="services"`, `id="reviews"`)
- An `aria-label` describing the section for screen readers
- Explicit `min-height` or `aspect-ratio` to prevent Cumulative Layout Shift

---

## 2. Component Map

All new components live under `/src/components/landing/`. No existing component in `/src/components/home/` is modified or deleted -- the migration plan (Section 5) handles the transition.

### 2.1 Component Inventory

#### StickyNav

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/StickyNav.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | Fixed top navigation bar for the landing page. Contains brand logo, navigation links (Services, Reviews, About, Contact), and a primary "Book Now" CTA button. Transparent on page load, gains a solid white background with drop shadow after scrolling past the hero. |
| **Dependencies** | `next/link`, `next/image`, `lucide-react` (Menu, X icons for mobile hamburger), `zustand` or `useState` for mobile menu toggle |
| **Key behavior** | Uses `IntersectionObserver` on the hero section to toggle between transparent and solid states. Mobile: hamburger menu with slide-in drawer. Desktop: horizontal link list. |

#### HeroVideoCarousel

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/HeroVideoCarousel.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | Full-viewport hero section cycling through 3 background videos with overlay text, subheading, and CTA button. Each slide has a unique headline/subtext. Autoplay, muted, looping. Includes dot indicators for manual navigation. |
| **Dependencies** | `react` (useRef, useState, useEffect, useCallback), `next/image` (poster fallbacks) |
| **Key behavior** | Preloads only the first video. Remaining videos lazy-load via `IntersectionObserver` when their slide becomes active. Falls back to poster image if autoplay is blocked (iOS low-power mode). Pause on `document.hidden`. Progress bar under each dot shows current video playback position. Respects `prefers-reduced-motion` -- shows static poster with no transitions. |

#### StatsCounter

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/StatsCounter.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | Horizontal row of milestone counters (e.g., "10,000+ Happy Customers", "500+ Expert Therapists", "50+ Treatments", "4.8 Average Rating"). Numbers animate from 0 to target value when the section scrolls into view. |
| **Dependencies** | `react` (useRef, useState, useEffect), `IntersectionObserver` |
| **Key behavior** | Counter animation runs once (tracked by a ref). Uses `requestAnimationFrame` for smooth counting over 2 seconds. Static server-rendered fallback shows final numbers for SEO. |

#### ServiceShowcase

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/ServiceShowcase.tsx` |
| **Type**      | Server component (default) with a client sub-component for carousel interaction |
| **Purpose**   | Displays top service categories in two layouts -- 3 large featured cards (desktop) and a horizontally scrollable row of 6 circular category thumbnails (mobile). Each links to `/services/[slug]`. |
| **Dependencies** | `next/image`, `next/link`, existing category images from `/public/images/categories/` |
| **Key behavior** | Server-renders the category list for SEO. Category data is a static array (no Firestore dependency for the landing page). Links use the same slugs as the existing `/services/[slug]` pages. |

#### PromoBanners

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/PromoBanners.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | One or two promotional banner cards with gradient backgrounds, deal text, countdown timer (if applicable), and CTA. Links to `/offers` or specific service pages. |
| **Dependencies** | `next/image`, `next/link`, `date-fns` (countdown formatting) |
| **Key behavior** | Countdown timer updates every second via `setInterval`. If no active deal exists, the section renders a static seasonal banner instead. |

#### BrandStory

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/BrandStory.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | Split-layout section: left side shows brand narrative text (heading, paragraphs, brand values list), right side shows an inline video player with custom play/pause controls. On mobile, stacks vertically (text above video). |
| **Dependencies** | `react` (useRef, useState), `next/image` (video poster), `lucide-react` (Play, Pause icons) |
| **Key behavior** | Video does NOT autoplay -- user must click to play. Custom play button overlays the poster. Pauses if scrolled out of viewport (IntersectionObserver). |

#### TrustBadges

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/TrustBadges.tsx` |
| **Type**      | Server component (default) |
| **Purpose**   | Horizontal row of trust indicators: "Certified Therapists", "Hygienic Products", "On-Time Guarantee", "Satisfaction Guaranteed", "Secure Payments". Each has an icon, title, and one-line description. |
| **Dependencies** | `lucide-react` (ShieldCheck, Sparkles, Clock, ThumbsUp, Lock icons) |
| **Key behavior** | Purely presentational. Server-rendered. On mobile, wraps into a 2-column grid. On desktop, displays as a 5-column row. |

#### ReviewsCarousel

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/ReviewsCarousel.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | Horizontally scrollable carousel of customer review cards. Each card shows reviewer name, avatar, star rating, review text (truncated), and date. Includes left/right navigation arrows on desktop. |
| **Dependencies** | `react` (useRef, useState, useCallback), `next/image`, `lucide-react` (Star, ChevronLeft, ChevronRight) |
| **Key behavior** | Touch-swipeable on mobile. Uses CSS `scroll-snap-type: x mandatory` for native scroll snapping. Arrow buttons scroll by one card width. Reviews are a static curated array (not fetched from Firestore on the landing page, to avoid auth dependency). Optionally, a future iteration can fetch from Firestore using a public API endpoint. |

#### BookingCTA

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/BookingCTA.tsx` |
| **Type**      | Server component (default) |
| **Purpose**   | Full-width call-to-action section with a background image, overlay gradient, heading ("Ready to Pamper Yourself?"), subtext, and two CTA buttons: "Book Now" (primary, links to `/services`) and "Call Us" (secondary, `tel:` link). |
| **Dependencies** | `next/image`, `next/link` |
| **Key behavior** | Background image uses `next/image` with `fill` and `priority={false}`. Overlay is a CSS gradient from brand-maroon-900/70 to brand-maroon-800/50. |

#### FAQAccordion

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/FAQAccordion.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | Expandable FAQ section with 6-8 common questions. Only one item is open at a time. Uses semantic HTML `<details>`/`<summary>` as a base with enhanced JS for animation. |
| **Dependencies** | `react` (useState), `lucide-react` (ChevronDown icon) |
| **Key behavior** | Full keyboard navigation: Enter/Space to toggle, arrow keys to move between items. Includes JSON-LD `FAQPage` structured data for Google rich results. Smooth expand/collapse animation using `max-height` transition (or the existing `accordion-down`/`accordion-up` keyframes from `tailwind.config.ts`). |

#### SEOContent

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/SEOContent.tsx` |
| **Type**      | Server component (default) |
| **Purpose**   | Hidden-on-initial-load text block with long-form SEO content about Glamornate, service descriptions, and location-specific text. Visually collapsed behind a "Read More" toggle. Rendered in the DOM for crawlers regardless of collapsed state. |
| **Dependencies** | None (pure HTML/CSS) |
| **Key behavior** | Always server-rendered. Content is in the DOM for SEO. Visual toggle uses CSS `max-height` with `overflow: hidden` -- no JS-dependent content hiding that would block crawlers. |

#### LandingFooter

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/LandingFooter.tsx` |
| **Type**      | Server component (default) |
| **Purpose**   | Full-width footer tailored for the landing page. Includes brand logo, tagline, 4-column link grid (Company, Services, Support, Legal), social media icons, app download badges (future), and copyright. Visually distinct from the existing `BrandFooter` (which is mobile-app-style) and the existing `Footer` component (which is used on public pages). |
| **Dependencies** | `next/link`, `lucide-react` (Instagram, Facebook, Twitter, Mail, Phone, MapPin icons) |
| **Key behavior** | Links to existing pages (/about, /contact, /blog, /help, /terms, /privacy, /partner, /services). Reuses the same link structure as `/src/components/layout/Footer.tsx` but with a landing-page visual treatment (dark background, brand gradient accents). |

#### WhatsAppButton

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/WhatsAppButton.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | Fixed-position floating button (bottom-right) that opens WhatsApp with a pre-filled message. Green circular button with the WhatsApp icon. |
| **Dependencies** | `lucide-react` (MessageCircle icon, or a custom WhatsApp SVG) |
| **Key behavior** | Uses `https://wa.me/<phone>?text=<encoded_message>` deeplink. Includes a pulse animation on first appearance, then settles. Hidden on screens narrower than 320px to avoid overlap with other fixed elements. |

#### BackToTop

| Property      | Value |
|---------------|-------|
| **Path**      | `/src/components/landing/BackToTop.tsx` |
| **Type**      | Client component (`'use client'`) |
| **Purpose**   | Fixed-position button (bottom-right, positioned above WhatsAppButton) that smooth-scrolls to the top of the page. Only visible after the user scrolls past 600px. |
| **Dependencies** | `react` (useState, useEffect), `lucide-react` (ArrowUp icon) |
| **Key behavior** | Tracks scroll position via a throttled `scroll` event listener (throttled to 100ms). Uses `window.scrollTo({ top: 0, behavior: 'smooth' })`. Fades in/out with a 200ms CSS transition. Respects `prefers-reduced-motion` by using instant scroll instead of smooth. |

### 2.2 Component Summary Table

| Component           | File Path                                            | Client/Server | Lines Est. |
|----------------------|------------------------------------------------------|---------------|------------|
| StickyNav            | `/src/components/landing/StickyNav.tsx`              | Client        | 120--160   |
| HeroVideoCarousel    | `/src/components/landing/HeroVideoCarousel.tsx`      | Client        | 200--280   |
| StatsCounter         | `/src/components/landing/StatsCounter.tsx`            | Client        | 80--120    |
| ServiceShowcase      | `/src/components/landing/ServiceShowcase.tsx`         | Server        | 100--150   |
| PromoBanners         | `/src/components/landing/PromoBanners.tsx`            | Client        | 120--160   |
| BrandStory           | `/src/components/landing/BrandStory.tsx`              | Client        | 140--200   |
| TrustBadges          | `/src/components/landing/TrustBadges.tsx`             | Server        | 60--80     |
| ReviewsCarousel      | `/src/components/landing/ReviewsCarousel.tsx`         | Client        | 160--220   |
| BookingCTA           | `/src/components/landing/BookingCTA.tsx`              | Server        | 50--70     |
| FAQAccordion         | `/src/components/landing/FAQAccordion.tsx`            | Client        | 100--140   |
| SEOContent           | `/src/components/landing/SEOContent.tsx`              | Server        | 60--80     |
| LandingFooter        | `/src/components/landing/LandingFooter.tsx`           | Server        | 100--140   |
| WhatsAppButton       | `/src/components/landing/WhatsAppButton.tsx`          | Client        | 40--60     |
| BackToTop            | `/src/components/landing/BackToTop.tsx`               | Client        | 50--70     |

**Total new components**: 14  
**Estimated total lines**: 1,380--1,930

### 2.3 Shared Utilities (Optional Extraction)

If multiple landing components share behavior, extract these into `/src/lib/landing/`:

| Utility                     | Path                                      | Purpose                                                   |
|-----------------------------|-------------------------------------------|-----------------------------------------------------------|
| `useIntersectionObserver`   | `/src/lib/hooks/useIntersectionObserver.ts` | Shared hook for scroll-triggered animations and lazy loading |
| `useScrollPosition`         | `/src/lib/hooks/useScrollPosition.ts`      | Throttled scroll position tracker for StickyNav and BackToTop |
| `landing-data.ts`           | `/src/lib/landing/landing-data.ts`         | Static data: FAQ items, stat numbers, curated reviews, service categories |

---

## 3. Video Asset Requirements

### 3.1 Hero Videos (3 required)

All hero videos autoplay muted and loop. They serve as cinematic background visuals behind overlay text.

| Video | File Name | Content Description | Duration | Resolution | Format | Max Size |
|-------|-----------|---------------------|----------|------------|--------|----------|
| Hero 1 | `hero-spa-treatment.mp4` / `.webm` | Close-up of a relaxing facial or spa treatment in progress. Warm lighting, calm atmosphere. Hands of a therapist working on a client. | 8--12s | 1920x1080 min | MP4 (H.264) + WebM (VP9) | 5 MB each |
| Hero 2 | `hero-salon-interior.mp4` / `.webm` | Wide shot panning through a luxurious salon/spa interior. Focus on ambient details: candles, flowers, premium products on shelves. | 10--15s | 1920x1080 min | MP4 (H.264) + WebM (VP9) | 5 MB each |
| Hero 3 | `hero-happy-customer.mp4` / `.webm` | A customer smiling after a treatment, examining their hair or skin in a mirror. Conveys satisfaction and the premium experience. | 8--12s | 1920x1080 min | MP4 (H.264) + WebM (VP9) | 5 MB each |

**Technical requirements for all hero videos:**
- Framerate: 24fps or 30fps
- Aspect ratio: 16:9 (desktop), cropped center for mobile via CSS `object-fit: cover`
- Audio: None (stripped at encoding to reduce file size)
- Compression: CRF 28--32 for H.264, CRF 35--40 for VP9 (background video tolerance)
- First frame should be visually meaningful (serves as fallback before decode)
- No text or logos burned into the video (overlay text is rendered via HTML)

### 3.2 Brand Story Video (1 required)

This video is user-initiated (click to play), so quality expectations are higher.

| Video | File Name | Content Description | Duration | Resolution | Format | Max Size |
|-------|-----------|---------------------|----------|------------|--------|----------|
| Brand Story | `brand-story.mp4` / `.webm` | Narrated brand video: founding story of Glamornate, behind-the-scenes of therapist training, product selection process, and happy customer testimonials. Can include on-screen text overlays and music. | 60--90s | 1920x1080 | MP4 (H.264) + WebM (VP9) | 15 MB (MP4), 12 MB (WebM) |

**Technical requirements:**
- Framerate: 30fps
- Audio: Yes (music + optional narration). Encode AAC 128kbps.
- Compression: CRF 23--26 for H.264 (higher quality since user-initiated)
- Subtitles: Provide a `.vtt` file for accessibility (`brand-story-captions.vtt`)

### 3.3 Poster Images (4 required)

Every video needs a poster image displayed before the video loads/plays. These also serve as the fallback when autoplay is blocked.

| Poster | File Name | Source | Dimensions | Format | Max Size |
|--------|-----------|--------|------------|--------|----------|
| Hero 1 poster | `hero-spa-treatment-poster.jpg` | First frame or best frame of Hero 1 video | 1920x1080 | JPEG (quality 80) | 150 KB |
| Hero 2 poster | `hero-salon-interior-poster.jpg` | First frame or best frame of Hero 2 video | 1920x1080 | JPEG (quality 80) | 150 KB |
| Hero 3 poster | `hero-happy-customer-poster.jpg` | First frame or best frame of Hero 3 video | 1920x1080 | JPEG (quality 80) | 150 KB |
| Brand Story poster | `brand-story-poster.jpg` | Cinematic still frame from the brand video | 1920x1080 | JPEG (quality 85) | 200 KB |

### 3.4 Video File Structure

```
/public/videos/
  hero-spa-treatment.mp4
  hero-spa-treatment.webm
  hero-salon-interior.mp4
  hero-salon-interior.webm
  hero-happy-customer.mp4
  hero-happy-customer.webm
  brand-story.mp4
  brand-story.webm
  brand-story-captions.vtt
/public/images/landing/
  hero-spa-treatment-poster.jpg
  hero-salon-interior-poster.jpg
  hero-happy-customer-poster.jpg
  brand-story-poster.jpg
```

---

## 4. Image Asset Requirements

### 4.1 Images That Can Reuse Existing Assets

The following existing images in `/public/images/categories/` can be reused for the ServiceShowcase section:

| Showcase Slot | Existing Image Path | Category |
|---------------|---------------------|----------|
| Circle 1      | `/public/images/categories/facials.jpg` | Facials |
| Circle 2      | `/public/images/categories/waxing.jpg` | Waxing |
| Circle 3      | `/public/images/categories/manicure-pedicure.jpg` | Mani-Pedi |
| Circle 4      | `/public/images/categories/hair-spa.jpg` | Hair Spa |
| Circle 5      | `/public/images/categories/clean-ups.jpg` | Clean-ups |
| Circle 6      | `/public/images/categories/body-polishing-massage.jpg` | Body Massage |
| Featured 1    | `/public/images/categories/facials.jpg` | Facials (large card) |
| Featured 2    | `/public/images/categories/hair-transformation.jpg` | Hair (large card) |
| Featured 3    | `/public/images/categories/body-polishing-massage.jpg` | Body (large card) |

### 4.2 New Images Required

| Image | File Name | Description | Dimensions | Format | Max Size | Location |
|-------|-----------|-------------|------------|--------|----------|----------|
| Promo Banner 1 | `promo-seasonal.jpg` | Seasonal promotional banner. Lifestyle shot of a woman enjoying a spa day. Text overlay rendered via HTML. | 1200x600 | JPEG | 120 KB | `/public/images/landing/` |
| Promo Banner 2 | `promo-first-booking.jpg` | First-booking discount banner. Close-up of premium beauty products or a treatment setup. | 1200x600 | JPEG | 120 KB | `/public/images/landing/` |
| Booking CTA Background | `cta-background.jpg` | Wide shot of a serene spa environment. Muted, warm tones that work under a dark gradient overlay. | 1920x800 | JPEG | 200 KB | `/public/images/landing/` |
| Trust: Certified | `trust-certified.svg` | Shield with checkmark icon | 48x48 | SVG | 2 KB | `/public/images/landing/trust/` |
| Trust: Hygienic | `trust-hygienic.svg` | Sparkle/clean icon | 48x48 | SVG | 2 KB | `/public/images/landing/trust/` |
| Trust: On-Time | `trust-ontime.svg` | Clock icon | 48x48 | SVG | 2 KB | `/public/images/landing/trust/` |
| Trust: Satisfaction | `trust-satisfaction.svg` | Thumbs-up icon | 48x48 | SVG | 2 KB | `/public/images/landing/trust/` |
| Trust: Secure | `trust-secure.svg` | Lock/payment icon | 48x48 | SVG | 2 KB | `/public/images/landing/trust/` |

**Note on trust badge icons**: The TrustBadges component specification uses `lucide-react` icons as the primary implementation. The SVG files listed above are an alternative if custom-designed icons are preferred for brand consistency. The implementation can use either approach -- `lucide-react` is the default recommendation to avoid additional asset production.

### 4.3 New Image File Structure

```
/public/images/landing/
  hero-spa-treatment-poster.jpg
  hero-salon-interior-poster.jpg
  hero-happy-customer-poster.jpg
  brand-story-poster.jpg
  promo-seasonal.jpg
  promo-first-booking.jpg
  cta-background.jpg
  trust/
    trust-certified.svg    (optional, can use lucide-react instead)
    trust-hygienic.svg     (optional)
    trust-ontime.svg       (optional)
    trust-satisfaction.svg (optional)
    trust-secure.svg       (optional)
```

### 4.4 Image Optimization Pipeline

All new JPEG/PNG images must be processed through the existing optimization pipeline before deployment:

```bash
pnpm optimize:images    # runs /scripts/optimize-images.mjs
pnpm generate:blur      # runs /scripts/generate-blur.mjs (generates blur placeholders)
```

All images rendered via `next/image` will automatically receive:
- Responsive `srcSet` generation
- WebP/AVIF format negotiation
- Blur placeholder (from the `generate:blur` script)
- Lazy loading (default) or `priority` for above-the-fold images

---

## 5. Migration Plan

The migration is designed to be zero-downtime and fully reversible at every phase. No existing page, component, or route is deleted until the landing page is validated in production.

### Phase 1: Build Landing Components (No Risk)

**Scope**: Create all 14 components in `/src/components/landing/`. This phase touches zero existing files.

**Steps**:
1. Create the `/src/components/landing/` directory
2. Implement all 14 components (see Section 2 for the full list)
3. Create `/src/lib/landing/landing-data.ts` with static data (FAQs, stats, reviews, service categories)
4. Create shared hooks in `/src/lib/hooks/` if not already present (`useIntersectionObserver`, `useScrollPosition`)
5. Add video and image assets to `/public/videos/` and `/public/images/landing/`
6. Run `pnpm optimize:images` and `pnpm generate:blur` to process new images

**Verification**: Import and render each component in isolation (e.g., via a temporary `/src/app/landing-preview/page.tsx` route during development). Run `pnpm build` to confirm no type errors.

**Risk**: None. All work is additive. No existing files are modified.

### Phase 2: Create Landing Route Group (Low Risk)

**Scope**: Introduce a Next.js route group `(landing)` to host the new landing page alongside the existing routes.

**Steps**:
1. Create `/src/app/(landing)/layout.tsx` -- a minimal layout that renders `<StickyNav />`, `{children}`, `<WhatsAppButton />`, `<BackToTop />`
2. Create `/src/app/(landing)/page.tsx` -- assembles all landing sections in order (see Section 1.4)
3. The `(landing)` route group uses parentheses, so it does NOT affect the URL -- it still resolves to `/`

**Important**: At this point, both `/src/app/page.tsx` (existing) and `/src/app/(landing)/page.tsx` (new) define a route for `/`. Next.js does not allow two routes for the same path. Move to Phase 3 before deploying.

**Verification**: Temporarily rename the existing `page.tsx` to `page.tsx.bak` and confirm the landing page renders at `/`. Then restore.

### Phase 3: Relocate Current Homepage (Medium Risk)

**Scope**: Move the existing mobile-app homepage into its own route group so both pages can coexist.

**Steps**:
1. Create `/src/app/(app)/page.tsx` -- move the contents of the current `/src/app/page.tsx` here
2. Create `/src/app/(app)/layout.tsx` that wraps children with `<LocationHeader />`, the bottom nav padding, and other app-chrome elements currently provided by `ConditionalNav`
3. Delete the now-empty `/src/app/page.tsx` (its content lives in `(app)`)
4. Verify that `/src/app/(landing)/page.tsx` now resolves at `/` for unauthenticated users

**File moves**:
```
BEFORE:
  /src/app/page.tsx                  --> current homepage

AFTER:
  /src/app/(landing)/page.tsx        --> new landing page (unauthenticated)
  /src/app/(landing)/layout.tsx      --> landing-specific layout (StickyNav, no BottomNav)
  /src/app/(app)/page.tsx            --> existing app homepage (authenticated)
  /src/app/(app)/layout.tsx          --> app-specific layout (AppHeader, BottomNav)
```

**Verification**: Visit `/` in an incognito window -- should see the landing page. Visit `/` while logged in -- should see the app homepage. Run full test suite.

### Phase 4: Route Logic -- Auth-Based Page Switching

**Scope**: Implement the logic that routes unauthenticated visitors to the landing page and authenticated users to the app homepage.

**Implementation approach** (choose one):

**Option A -- Middleware (recommended)**:
```
/src/middleware.ts
```
- Check for the Firebase auth session cookie
- If no session cookie and path is `/`, rewrite to the `(landing)` route group
- If session cookie exists and path is `/`, rewrite to the `(app)` route group
- All other routes pass through unchanged

**Option B -- Client-side redirect in the landing page**:
- The `(landing)/page.tsx` checks auth state on mount
- If authenticated, redirect to `(app)` homepage via `router.replace()`
- Simpler but causes a flash of the landing page for authenticated users

**Recommendation**: Option A (middleware) for the best user experience. The middleware runs on the edge and handles the rewrite before the page renders, preventing any visual flash.

**Verification**: Test matrix:

| Scenario | Expected Result |
|----------|-----------------|
| Unauthenticated user visits `/` | Sees landing page |
| Authenticated user visits `/` | Sees app homepage |
| Unauthenticated user clicks "Book Now" on landing | Navigated to `/services` (or `/auth/login` if booking requires auth) |
| Authenticated user logs out on `/` | Sees landing page |
| Deep links (`/services/facials`) | Work identically for both user types |
| All existing pages | No behavior change |

### Phase 5: Cleanup (Post-Validation)

**Scope**: After the landing page has been live for 1--2 weeks with no issues, clean up temporary artifacts.

**Steps**:
1. Remove `/src/app/landing-preview/page.tsx` if it exists (development-only route)
2. Confirm analytics show landing page traffic and conversion
3. Document the route group architecture in the project README

---

## 6. Performance Budget

### 6.1 Core Web Vitals Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| **LCP** (Largest Contentful Paint) | < 2.5s | The hero video poster image is the LCP element. Mark it with `priority` in `next/image`. Preload via `<link rel="preload">` in the layout head. |
| **CLS** (Cumulative Layout Shift) | 0 | Every section has explicit dimensions (`min-height`, `aspect-ratio`, or fixed `height`). All images use `width`/`height` attributes via `next/image`. Fonts use `display: swap` (already configured in `layout.tsx`). |
| **FID** (First Input Delay) | < 100ms | Minimize main-thread JavaScript. Server components for static sections (TrustBadges, BookingCTA, SEOContent, LandingFooter, ServiceShowcase). Client components use `dynamic(() => import(...), { ssr: false })` only for non-critical interactive sections below the fold. |
| **INP** (Interaction to Next Paint) | < 200ms | Event handlers in FAQ, carousel, and nav are lightweight. No synchronous heavy computation on interaction. |
| **TTFB** (Time to First Byte) | < 800ms | Landing page can be statically generated (no Firestore dependency). Consider `export const revalidate = 3600` for ISR if any dynamic data is added later. |

### 6.2 Page Weight Budget

| Resource Category | Budget | Notes |
|-------------------|--------|-------|
| HTML | < 50 KB | Server-rendered, compressed with gzip/brotli |
| CSS (Tailwind) | < 30 KB | Purged at build time. Landing page adds minimal new utility classes. |
| JavaScript (total) | < 150 KB | Client components hydrate only what is needed. Shared chunks via Next.js code splitting. |
| First hero video | < 5 MB | Preloaded. MP4 with WebM fallback. |
| Hero poster images (3) | < 450 KB total | 150 KB each. Served as optimized JPEG via next/image. |
| Other images | < 500 KB | Lazy-loaded below the fold. |
| **Total initial load** | **< 3 MB** | Includes first hero video + poster + HTML/CSS/JS. |

### 6.3 Video Loading Strategy

```
Priority:  hero-spa-treatment.mp4 (preload)
           hero-spa-treatment-poster.jpg (preload, LCP candidate)

Lazy:      hero-salon-interior.mp4 (load when slide 2 becomes active)
           hero-happy-customer.mp4 (load when slide 3 becomes active)
           brand-story.mp4 (load when BrandStory section enters viewport)
```

Implementation:
- First video: `<video preload="auto">` with `<link rel="preload" as="video" href="...">` in layout
- Subsequent videos: `<video preload="none">` with `src` set dynamically via IntersectionObserver
- Brand story video: `<video preload="none">` until user scrolls into the BrandStory section

### 6.4 Image Loading Strategy

- **Above the fold** (hero poster, StickyNav logo): `next/image` with `priority={true}`
- **Below the fold** (all other images): `next/image` with default lazy loading
- **Blur placeholders**: Generated by the existing `pnpm generate:blur` script
- **Format negotiation**: Next.js image optimizer serves WebP/AVIF automatically

### 6.5 Font Loading

Already optimized in the existing `layout.tsx`:
- `Inter` (sans-serif) and `Playfair_Display` (serif) loaded via `next/font/google`
- `display: swap` prevents invisible text during font load
- Font files are self-hosted by Next.js (no external Google Fonts requests)

---

## 7. Implementation Sprints

### Sprint 1: Core Layout (Estimated: 5--7 days)

**Goal**: Landing page skeleton is navigable with the hero and primary content sections.

| Task | Component(s) | Priority | Est. Hours |
|------|--------------|----------|------------|
| 1.1 Set up `/src/components/landing/` directory and shared hooks | `useIntersectionObserver`, `useScrollPosition` | P0 | 2 |
| 1.2 Create static data file | `landing-data.ts` (FAQs, stats, reviews, categories) | P0 | 2 |
| 1.3 Build StickyNav | `StickyNav.tsx` | P0 | 6 |
| 1.4 Build HeroVideoCarousel | `HeroVideoCarousel.tsx` | P0 | 10 |
| 1.5 Build StatsCounter | `StatsCounter.tsx` | P1 | 4 |
| 1.6 Build ServiceShowcase | `ServiceShowcase.tsx` | P0 | 6 |
| 1.7 Create landing page route | `(landing)/page.tsx`, `(landing)/layout.tsx` | P0 | 3 |
| 1.8 Source/produce hero video assets | 3 videos + 3 posters | P0 | External |

**Sprint 1 Definition of Done**:
- Landing page loads at `/` (dev only, behind feature flag or temp route)
- StickyNav transitions from transparent to solid on scroll
- Hero carousel cycles through 3 slides with poster fallbacks
- Stats counter animates on scroll-in
- Service showcase displays categories and links to existing `/services/[slug]` pages
- Lighthouse Performance score > 80 on the sprint-1 build

### Sprint 2: Content Sections (Estimated: 5--7 days)

**Goal**: All mid-page content sections are complete and the page tells the full brand story.

| Task | Component(s) | Priority | Est. Hours |
|------|--------------|----------|------------|
| 2.1 Build PromoBanners | `PromoBanners.tsx` | P1 | 5 |
| 2.2 Build BrandStory | `BrandStory.tsx` | P1 | 6 |
| 2.3 Build TrustBadges | `TrustBadges.tsx` | P1 | 3 |
| 2.4 Build ReviewsCarousel | `ReviewsCarousel.tsx` | P0 | 8 |
| 2.5 Source/produce brand story video | 1 video + 1 poster + captions | P1 | External |
| 2.6 Source promo banner images | 2 images | P1 | External |
| 2.7 Integration: wire all Sprint 1 + 2 sections into landing page | `(landing)/page.tsx` | P0 | 2 |

**Sprint 2 Definition of Done**:
- All mid-page sections render correctly at all breakpoints
- Reviews carousel is swipeable on touch and navigable via arrows on desktop
- Brand story video plays on click with custom controls
- Trust badges render in a responsive grid
- Promo banners display with countdown (if active deal)
- Lighthouse Performance score > 85

### Sprint 3: Footer, Polish, and Migration (Estimated: 5--7 days)

**Goal**: Page is production-ready, migration is complete, and all quality gates pass.

| Task | Component(s) | Priority | Est. Hours |
|------|--------------|----------|------------|
| 3.1 Build BookingCTA | `BookingCTA.tsx` | P0 | 3 |
| 3.2 Build FAQAccordion | `FAQAccordion.tsx` | P1 | 5 |
| 3.3 Build SEOContent | `SEOContent.tsx` | P1 | 3 |
| 3.4 Build LandingFooter | `LandingFooter.tsx` | P0 | 5 |
| 3.5 Build WhatsAppButton | `WhatsAppButton.tsx` | P2 | 2 |
| 3.6 Build BackToTop | `BackToTop.tsx` | P2 | 2 |
| 3.7 Execute Migration Phase 2--4 | Route groups, middleware | P0 | 6 |
| 3.8 Mobile QA pass | All components, all breakpoints | P0 | 4 |
| 3.9 Accessibility audit | Keyboard nav, screen reader, contrast | P0 | 3 |
| 3.10 Performance audit | Lighthouse, WebPageTest | P0 | 3 |
| 3.11 Cross-browser testing | Safari, Chrome, Firefox, Edge | P1 | 3 |
| 3.12 Add JSON-LD structured data | FAQPage, LocalBusiness schemas | P1 | 2 |

**Sprint 3 Definition of Done**:
- Full landing page is live at `/` for unauthenticated users
- Authenticated users see the existing app homepage at `/`
- All existing routes continue to function without changes
- Lighthouse scores: Performance > 90, Accessibility > 95, SEO > 95, Best Practices > 95
- FAQ accordion is fully keyboard-navigable
- All videos play correctly on iOS Safari, Chrome Android, Chrome Desktop
- WhatsApp button and Back to Top function correctly
- No CLS on any breakpoint
- JSON-LD structured data validates in Google Rich Results Test

---

## 8. Testing Checklist

### 8.1 Responsive Breakpoints

Every section of the landing page must be visually tested at the following breakpoints:

| Breakpoint | Device Reference | Viewport Width | Key Checks |
|------------|------------------|----------------|------------|
| XS         | iPhone SE        | 375px          | No horizontal overflow. Text readable without zooming. Touch targets >= 44px. |
| SM         | iPhone 14        | 390px          | Hero text does not overflow. Category circles fit in a single scrollable row. |
| MD         | iPad             | 768px           | 2-column layouts activate. StickyNav shows full link list (no hamburger). |
| LG         | iPad Pro         | 1024px          | 3-column service cards. Brand story shows side-by-side layout. |
| XL         | Desktop          | 1440px          | Full 5-column trust badges. Max-width containers center content. |
| 2XL        | Large Desktop    | 1920px          | No content stretches beyond `1400px` container (per `tailwind.config.ts`). Background images/videos fill edge-to-edge. |

### 8.2 Video Autoplay Testing

| Browser / OS | Test Scenario | Expected Behavior |
|--------------|---------------|-------------------|
| iOS Safari (iPhone) | Page load | Video autoplays muted. If autoplay blocked (low power mode), poster image displays. |
| iOS Safari (iPhone) | `prefers-reduced-motion: reduce` | Static poster image, no video playback, no carousel auto-advance. |
| Chrome Android | Page load | Video autoplays muted. |
| Chrome Desktop (macOS/Windows) | Page load | Video autoplays muted with smooth fade transition between slides. |
| Firefox Desktop | Page load | Video autoplays muted. Verify WebM source is served. |
| Safari Desktop (macOS) | Page load | Video autoplays muted. |

### 8.3 Carousel Interaction Testing

| Test | Input Method | Expected Behavior |
|------|-------------|-------------------|
| Swipe left on hero | Touch (mobile) | Advances to next slide. Dot indicator updates. |
| Swipe right on hero | Touch (mobile) | Returns to previous slide (or wraps to last). |
| Click right arrow on reviews | Mouse (desktop) | Scrolls carousel by one card width. Smooth animation. |
| Click left arrow on reviews | Mouse (desktop) | Scrolls back by one card width. Left arrow hidden at start. |
| Drag/swipe on reviews | Touch (mobile) | Scrolls with scroll-snap. Snaps to nearest card on release. |
| Auto-advance hero | Timer | Advances every video duration. Resets timer on manual interaction. |

### 8.4 FAQ Accordion Keyboard Navigation

| Key | Context | Expected Behavior |
|-----|---------|-------------------|
| Tab | Page navigation | Focuses the first FAQ item trigger. |
| Enter / Space | FAQ item focused | Toggles the item open/closed. |
| Arrow Down | FAQ item focused | Moves focus to the next FAQ item trigger. |
| Arrow Up | FAQ item focused | Moves focus to the previous FAQ item trigger. |
| Home | FAQ item focused | Moves focus to the first FAQ item. |
| End | FAQ item focused | Moves focus to the last FAQ item. |
| Escape | FAQ item open | Closes the open item (optional enhancement). |

Screen reader expectations:
- Each FAQ trigger has `aria-expanded="true/false"`
- Each FAQ content panel has `role="region"` and `aria-labelledby` pointing to the trigger
- Opening/closing an item announces the state change

### 8.5 Performance Audit

| Tool | Target Score / Metric | Pass Criteria |
|------|----------------------|---------------|
| Lighthouse (Mobile) | Performance | >= 90 |
| Lighthouse (Mobile) | Accessibility | >= 95 |
| Lighthouse (Mobile) | Best Practices | >= 95 |
| Lighthouse (Mobile) | SEO | >= 95 |
| Lighthouse (Desktop) | Performance | >= 95 |
| WebPageTest (3G Slow) | LCP | < 4.0s |
| WebPageTest (4G) | LCP | < 2.5s |
| WebPageTest | Total Blocking Time | < 200ms |
| WebPageTest | CLS | 0 |
| Chrome DevTools Coverage | Unused CSS | < 20% of delivered CSS |
| Chrome DevTools Coverage | Unused JS | < 30% of delivered JS |
| `next build` output | Page size | < 150 KB (JS) for landing route |

### 8.6 Reduced Motion Preference Handling

When `prefers-reduced-motion: reduce` is active:

| Component | Reduced Motion Behavior |
|-----------|------------------------|
| HeroVideoCarousel | No autoplay. Display poster images only. No slide transitions. Manual dot navigation still works (instant switch). |
| StatsCounter | Numbers display at final value immediately. No counting animation. |
| StickyNav | Background change is instant (no transition). |
| ReviewsCarousel | No scroll animations. Snapping still works. |
| BackToTop | Instant scroll (not smooth). No fade-in animation. |
| WhatsAppButton | No pulse animation on appearance. |
| FAQAccordion | Instant expand/collapse (no height transition). |
| PromoBanners | No slide-in or fade effects. |

### 8.7 Cross-Browser Compatibility

| Browser | Version | Priority | Notes |
|---------|---------|----------|-------|
| Chrome (Desktop) | Latest 2 versions | P0 | Primary development target |
| Safari (macOS) | Latest 2 versions | P0 | Font rendering, video autoplay |
| Safari (iOS) | Latest 2 versions | P0 | Touch events, video autoplay policy, safe area insets |
| Chrome (Android) | Latest 2 versions | P0 | Primary mobile target |
| Firefox (Desktop) | Latest 2 versions | P1 | WebM video, CSS grid |
| Samsung Internet | Latest version | P2 | Large Android market share in India |
| Edge (Desktop) | Latest 2 versions | P2 | Chromium-based, minimal issues expected |

### 8.8 SEO Validation

| Check | Tool | Expected Result |
|-------|------|-----------------|
| Structured data (FAQPage) | Google Rich Results Test | Valid, no errors |
| Structured data (LocalBusiness) | Google Rich Results Test | Valid, no errors |
| Meta tags | View page source | Title, description, OG tags, Twitter cards present |
| Heading hierarchy | axe DevTools | Single H1, logical H2/H3 nesting |
| Image alt text | axe DevTools | All `next/image` instances have descriptive `alt` |
| Canonical URL | View page source | `<link rel="canonical" href="https://glamornate.com/">` |
| Robots | View page source | No `noindex` on landing page |
| Mobile-friendliness | Google Mobile-Friendly Test | Pass |
| Core Web Vitals | PageSpeed Insights | All green |

### 8.9 Accessibility Audit

| WCAG Criterion | Check | Tool |
|----------------|-------|------|
| 1.1.1 Non-text Content | All images have alt text, videos have captions | axe DevTools |
| 1.4.3 Contrast (Minimum) | Text over hero video overlay meets 4.5:1 | Chrome contrast checker |
| 1.4.11 Non-text Contrast | UI controls (buttons, nav) meet 3:1 against background | Manual |
| 2.1.1 Keyboard | All interactive elements reachable and operable via keyboard | Manual tab-through |
| 2.4.1 Bypass Blocks | Skip-to-content link present (already in `layout.tsx`) | Manual |
| 2.4.7 Focus Visible | Visible focus indicators on all interactive elements | Manual |
| 3.1.1 Language of Page | `<html lang="en">` (already set in `layout.tsx`) | View source |
| 4.1.2 Name, Role, Value | ARIA attributes on FAQ, carousel, nav | axe DevTools |

---

## Appendix A: Dependency Matrix

This table shows which new landing components depend on which existing codebase elements.

| New Component | Depends on (existing) | Depends on (new) |
|---------------|----------------------|-------------------|
| StickyNav | `next/link`, `next/image`, brand color tokens | -- |
| HeroVideoCarousel | `next/image` | `useIntersectionObserver`, video assets |
| StatsCounter | -- | `useIntersectionObserver`, `landing-data.ts` |
| ServiceShowcase | `next/image`, `next/link`, `/public/images/categories/*` | `landing-data.ts` |
| PromoBanners | `next/image`, `next/link`, `date-fns` | promo images |
| BrandStory | `next/image` | `useIntersectionObserver`, brand story video |
| TrustBadges | `lucide-react` | -- |
| ReviewsCarousel | `next/image`, `lucide-react` | `landing-data.ts` |
| BookingCTA | `next/image`, `next/link` | CTA background image |
| FAQAccordion | `lucide-react` | `landing-data.ts` |
| SEOContent | -- | -- |
| LandingFooter | `next/link`, `lucide-react` | -- |
| WhatsAppButton | `lucide-react` | -- |
| BackToTop | `lucide-react` | `useScrollPosition` |

## Appendix B: Existing Files Affected by Migration

These are the ONLY existing files modified during the migration (Phase 3--4). No file is deleted.

| File | Change | Phase |
|------|--------|-------|
| `/src/app/page.tsx` | Content moved to `/src/app/(app)/page.tsx`. Original file deleted after content is relocated. | Phase 3 |
| `/src/app/layout.tsx` | No changes needed. Route groups inherit the root layout. | -- |
| `/src/components/layout/ConditionalNav.tsx` | May need an update to hide AppHeader/BottomNav on the `(landing)` route group if the landing layout does not already handle this. Add `pathname === '/' && !isAuthenticated` check, or rely on the route group layout to exclude ConditionalNav. | Phase 4 |
| `/src/middleware.ts` (new) | New file. Auth-based rewrite logic for `/` route. | Phase 4 |

All other files -- components, pages, utilities, styles -- remain untouched.
