# Glamornate Landing Page Redesign -- Complete PRD

**Product**: Glamornate -- Premium At-Home Spa Booking Platform  
**Version**: 2.0 (Final, Agent-Ready)  
**Date**: 2026-04-10  
**Reference**: Yes Madam (yesmadam.com/delhi-at-home-services-2)  
**Brand**: Maroon (#7A1F3D / #880E4F) + Gold (#D4A845 / #FFD700)

---

## 0. Tech Stack Architecture

### 0.1 Core Stack (Already Installed)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 15.1.3 | App Router, RSC, SSR/SSG, Image optimization |
| **Language** | TypeScript | 5.3.3 | Type safety across entire codebase |
| **UI Library** | React | 18.2 | Component architecture |
| **Styling** | Tailwind CSS | 3.4.1 | Utility-first CSS, brand design tokens |
| **Component Primitives** | Radix UI | Latest | Accessible dialog, accordion, tabs, popover, tooltip |
| **State Management** | Zustand | 4.4.7 | Cart, booking, chat stores (persisted + session) |
| **Data Fetching** | TanStack React Query | 5.17 | Server state, caching, mutations, optimistic updates |
| **Forms** | React Hook Form + Zod | 7.49 / 3.22 | Schema-validated forms with type inference |
| **Backend** | Firebase | 12.11 | Auth, Firestore, Cloud Functions, Storage |
| **Icons** | Lucide React | 0.316 | Consistent icon library (outline style, 1.5 strokeWidth) |
| **Image Optimization** | Sharp + next/image | 0.34 | Build-time resize, WebP/AVIF, blur placeholders |
| **Date Utilities** | date-fns | 3.3 | Lightweight date formatting |
| **CSS Utilities** | clsx + tailwind-merge + CVA | Latest | Conditional classes, variant management |
| **Testing** | Vitest + Testing Library + Playwright | Latest | Unit, integration, E2E |

### 0.2 New Dependencies Required for Landing Page

| Package | Version | Purpose | Install Command |
|---------|---------|---------|----------------|
| **framer-motion** | ^12.0 | Hero carousel crossfade, scroll-triggered animations, stagger reveals, spring physics for review carousel, count-up orchestration | `npm install framer-motion` |
| **@radix-ui/react-accordion** | ^1.1 | FAQ accordion (accessible, keyboard-navigable, single-expand mode) | Already in Radix UI suite or `npm install @radix-ui/react-accordion` |

### 0.3 Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Animation library** | Framer Motion (not GSAP) | Already React-native, supports `layout`/`layoutId`, `AnimatePresence`, and `useInView`. No DOM ref juggling. Project already has React 18 — FM12 is the best fit. |
| **Video hosting** | Self-hosted MP4/WebM in `/public/videos/` | For 4 videos under 8MB each, CDN via Vercel/Firebase is sufficient. No need for Mux/Cloudinary video at this scale. |
| **Carousel** | Custom with Framer Motion `AnimatePresence` | No external carousel library. FM's crossfade + `useInView` gives us everything. Avoids Swiper/Embla dependency bloat for 3 slides. |
| **Scroll animations** | Framer Motion `whileInView` + `useScroll` | Used for stats count-up, stagger reveals, and parallax effects. Single library for all motion. |
| **Server vs Client components** | Server by default, Client only for interactivity | `ServiceShowcase`, `PromoBanners`, `TrustBadges`, `LandingFooter` are Server Components. All others are Client (`'use client'`). |
| **FAQ accordion** | Radix UI Accordion | Accessible out of the box (keyboard nav, ARIA). Already in the project's Radix suite. |
| **Form validation** | Zod + React Hook Form | For the BookingCTA phone/email capture form. Same pattern as existing forms. |
| **CSS approach** | Tailwind only (no CSS Modules, no styled-components) | Consistent with entire codebase. All new components use Tailwind utilities. |

### 0.4 Design Token Reference (Existing in tailwind.config.ts)

```
Brand Colors:
  brand-maroon-50:  #FDF2F8     brand-maroon-100: #FCE7F3
  brand-maroon-200: #FBCFE8     brand-maroon-300: #F9A8D4
  brand-maroon-400: #C2185B     brand-maroon-500: #880E4F
  brand-maroon-600: #7B0C47     brand-maroon-700: #6D0A3E
  brand-maroon-800: #5E0836     brand-maroon-900: #4A062A
  brand-maroon-950: #3B0522

  brand-gold-50:  #FFFEF0      brand-gold-100: #FEF9C3
  brand-gold-200: #FEF08A      brand-gold-300: #FDE047
  brand-gold-400: #FACC15      brand-gold-500: #FFD700
  brand-gold-600: #EAB308      brand-gold-700: #CA8A04

Shadows:
  shadow-card-sm:    0 1px 3px rgba(0,0,0,0.06)
  shadow-card-md:    0 4px 6px rgba(0,0,0,0.07)
  shadow-card-hover: 0 10px 15px rgba(0,0,0,0.08)
  shadow-maroon:     0 4px 14px rgba(136,14,79,0.15)
  shadow-maroon-lg:  0 10px 40px rgba(136,14,79,0.3)

Fonts:
  --font-sans:  System sans-serif stack
  --font-serif: Brand serif (for hero headlines)
  --font-mono:  JetBrains Mono (for promo codes)

Utilities (existing):
  scrollbar-hide, focus-ring, touch-target, section-padding
  gradient-text-premium, btn-gradient, gradient-overlay-maroon
```

### 0.5 File Structure for New Landing Components

```
src/
  app/
    (landing)/
      page.tsx              -- Landing page (unauthenticated visitors)
      layout.tsx            -- Landing layout (no BottomNav, no app shell)
    (app)/
      page.tsx              -- Existing app homepage (authenticated users)
      layout.tsx            -- Existing app layout (with BottomNav, auth shell)
  components/
    landing/
      StickyNav.tsx         -- Client: sticky nav, transparent-to-solid scroll
      HeroVideoCarousel.tsx -- Client: 3 video crossfade carousel + overlay CTAs
      StatsCounter.tsx      -- Client: 5 animated milestone counters
      ServiceShowcase.tsx   -- Server: 3 large cards + 6 circles + CTA
      PromoBanners.tsx      -- Server: 2 gradient promo cards
      BrandStory.tsx        -- Client: wordmark heading + auto-playing video
      TrustBadges.tsx       -- Server: 4 trust indicators
      ReviewsCarousel.tsx   -- Client: rating display + 8 review cards carousel
      BookingCTA.tsx        -- Client: lead capture form
      FAQAccordion.tsx      -- Client: 10 Q&As (Radix accordion)
      SEOContent.tsx        -- Client: expandable long-form content
      LandingFooter.tsx     -- Server: 4-column footer + cities
      WhatsAppButton.tsx    -- Client: floating WhatsApp chat button
      BackToTop.tsx         -- Client: scroll-to-top button
  hooks/
    useCountUp.ts           -- Count-up animation hook (requestAnimationFrame)
  data/
    landing-content.ts      -- All static content (stats, reviews, FAQ, etc.)
```

### 0.6 Package.json Scripts (New)

```json
{
  "optimize:videos": "node scripts/optimize-videos.mjs",
  "dev:landing": "next dev -p 3000"
}
```

---

## 1. Executive Summary

This PRD defines a complete redesign of the Glamornate homepage from its current mobile-app-style layout to a premium marketing landing page inspired by Yes Madam. The redesign introduces:

- **Video hero carousel** with 3 auto-playing HD treatment videos (crossfade, 8s per slide)
- **Animated milestone counters** (500+ professionals, 50K+ customers, 100K+ services, 4.9 rating)
- **Service showcase** with 3 large category cards + 6 circular quick-access icons
- **Promotional banners** with gradient backgrounds (Facials + Bridal)
- **Brand story section** with embedded auto-playing video
- **Trust badges** (4 credibility indicators)
- **Customer review carousel** with 8 real-feel reviews + 4.9 aggregate rating
- **FAQ accordion** (10 Q&As) for SEO and user education
- **Comprehensive footer** with city coverage, social links, and WhatsApp chat

The existing booking flow (services, cart, checkout, auth) remains completely untouched. Only the landing experience changes.

---

## 2. Page Section Order

```
 1. StickyNav              -- Fixed z-50, transparent over hero, solid on scroll
 2. HeroVideoCarousel      -- 100vh, 3 videos, crossfade transition, mute toggle
 3. StatsCounter           -- 5 animated milestone counters (count-up on scroll)
 4. ServiceShowcase        -- 3 large cards + 6 circles + "Explore All Services" CTA
 5. PromoBanners           -- 2 gradient cards (Facials + Bridal)
 6. BrandStory             -- "The Glamornate Experience" + auto-playing video
 7. TrustBadges            -- 4 trust indicators on rose background
 8. ReviewsCarousel        -- 4.9 rating + 8 review cards horizontal carousel
 9. BookingCTA             -- Lead capture: phone/email + "Get Started"
10. FAQAccordion           -- 10 Q&As (single-expand Radix accordion)
11. SEOContent             -- Expandable long-form content for search
12. LandingFooter          -- 4-column footer + cities + copyright
```

**Floating Elements**: WhatsApp button (z-40, bottom-right), Back to Top (z-40, above WhatsApp)

---

## 3. Component Specifications

Each component's full design spec is in its dedicated section file. Below is the agent-ready summary for each.

### 3.1 StickyNav + HeroVideoCarousel
**Full spec**: [PRD-SECTION-1-HERO-NAV.md](PRD-SECTION-1-HERO-NAV.md)

**Agent instructions**: Build `StickyNav.tsx` (Client Component) and `HeroVideoCarousel.tsx` (Client Component).

- StickyNav: `fixed top-0 z-50`, 80px desktop / 64px mobile. Transparent state (white text over video) transitions to `bg-white/95 backdrop-blur-xl` at scroll > 80px. Logo left, links center (Home, Services, About, Blog, Contact), "Book Now" pill right. Mobile: hamburger -> slide-out drawer (320px, from right).
- HeroVideoCarousel: `100vh`, 3 `<video>` elements with crossfade (`AnimatePresence` from framer-motion, 1200ms). Auto-advance every 8s. Muted by default with toggle button (bottom-right, 44x44px). Carousel dots (bottom-center): inactive = 8x8 white circle, active = 32x8 gold pill. Poster image fallback on slow connections / reduced motion. `playsinline muted autoplay loop` on all videos. IntersectionObserver pauses when out of viewport.
- Headline: "Luxury Spa Experiences, **Delivered to Your Doorstep**" (gold accent). 56px desktop / 32px mobile.
- CTAs: "Book Your Service" (solid maroon pill) + "Register as Partner" (ghost gold outline pill).

### 3.2 StatsCounter + ServiceShowcase
**Full spec**: [PRD-SECTION-2-STATS-SERVICES.md](PRD-SECTION-2-STATS-SERVICES.md)

**Agent instructions**: Build `StatsCounter.tsx` (Client) and `ServiceShowcase.tsx` (Server).

- StatsCounter: 5 items in flex row (horizontal scroll + snap on mobile). Each: 56x56 maroon-50 circle icon + count-up number + label. Count-up: `requestAnimationFrame`, 2s, easeOutExpo, triggered by `useInView` (framer-motion). Stats: 500+ Professionals, 50K+ Customers, 100K+ Services, Jammu & Delhi NCR, 4.9 Rating.
- ServiceShowcase: Section title "Services We Offer". 3 large cards (flex row desktop, stack mobile): "Salon at Home", "Spa & Body Treatments", "Bridal & Special Occasions". Each: oval image + decorative blob (maroon/gold at 10% opacity) + title + description. Hover: lift + shadow + image zoom. 6 small category circles below (grid-cols-6 desktop, grid-cols-3 mobile): Waxing, Facials, Threading, Hair, Mani & Pedi, Bleach. Using existing `/images/categories/*.jpg`. CTA: "Explore All Services" pill button -> `/services`.

### 3.3 PromoBanners + BrandStory
**Full spec**: [PRD-SECTION-3-PROMOS-BRAND.md](PRD-SECTION-3-PROMOS-BRAND.md)

**Agent instructions**: Build `PromoBanners.tsx` (Server) and `BrandStory.tsx` (Client).

- PromoBanners: 2-column grid (stack on mobile). Banner A: "Premium Facials at Your Doorstep" on maroon gradient, gold CTA "Book a Facial" -> `/services/facials-cleanups`. Banner B: "Bridal Packages Tailored for You" on gold-to-cream gradient, maroon CTA "Explore Bridal" -> `/services/bridal-packages`. Each: heading + description + CTA button + right-aligned image + decorative blob. Hover: lift + shadow.
- BrandStory: Full-width section, subtle maroon gradient bg. Heading: "The **Glam**ornate Experience" (split-color wordmark). Description paragraph. CTA: "Discover Our Story" (gradient button) -> `/about`. Auto-playing muted video (16:9, rounded-2xl, max-w-4xl, shadow). IntersectionObserver play/pause. `preload="metadata"`.

### 3.4 TrustBadges + ReviewsCarousel
**Full spec**: [PRD-SECTION-4-REVIEWS-SOCIAL.md](PRD-SECTION-4-REVIEWS-SOCIAL.md)

**Agent instructions**: Build `TrustBadges.tsx` (Server) and `ReviewsCarousel.tsx` (Client).

- TrustBadges: 4-column grid (2x2 mobile) on rose bg. Badges: "Verified Professionals" (ShieldCheck), "Premium Products" (Sparkles), "On-Time Service" (Clock), "Satisfaction Guaranteed" (ThumbsUp). Each: maroon icon in 56x56 circle + title + subtitle. Hover lift.
- ReviewsCarousel: Split layout. Left: "4.9" (text-6xl bold) + gold star + "500+ reviews" + social links (Instagram, WhatsApp). Right: horizontal snap-scroll carousel of 8 review cards. Each card: 48px avatar (ui-avatars.com with maroon bg), name, star rating (1-5), review text (line-clamp-4). Auto-advance 5s, pause on hover. Arrow buttons (circular maroon outline, hidden on mobile). Pagination "3 / 8". 8 reviews with realistic Indian names and specific service mentions.

### 3.5 BookingCTA + FAQAccordion + Footer
**Full spec**: [PRD-SECTION-5-FOOTER-CTA.md](PRD-SECTION-5-FOOTER-CTA.md)

**Agent instructions**: Build `BookingCTA.tsx` (Client), `FAQAccordion.tsx` (Client), `SEOContent.tsx` (Client), `LandingFooter.tsx` (Server), `WhatsAppButton.tsx` (Client), `BackToTop.tsx` (Client).

- BookingCTA: Split layout on maroon-50 bg. Left: professional photo (4:3). Right: "Your Salon Experience, at Home" heading, "Book your first service and get 15% off" subtitle, phone input (+91) + "Get Started" button, "Or browse services" secondary link. Zod validated.
- FAQAccordion: Radix Accordion, single-expand. 10 Q&As covering: booking process, pricing, cancellation, professional quality, service areas, hygiene, group bookings, partner registration. Chevron rotation on expand. FAQPage JSON-LD for SEO.
- LandingFooter: 4-column grid on brand-maroon-950 bg. About | Quick Links | Legal | Get in Touch. City list: "Proudly Serving Jammu & Beyond". Social icons. Copyright.
- WhatsAppButton: Fixed bottom-right, z-40, green (#25D366), 56px, "Chat Now" tooltip, bounce animation (3 iterations on first visit), wa.me link with pre-filled message.
- BackToTop: Appears after 2vh scroll, smooth scroll to top, circular chevron-up button.

---

## 4. Video Assets Required

| File | Content | Duration | Format | Size Target | Location |
|------|---------|----------|--------|-------------|----------|
| hero-facial.mp4 | At-home facial treatment, warm lighting | 15-20s raw / 8s display | MP4 (H.264) + WebM (VP9) | <4MB each | `/public/videos/hero/` |
| hero-massage.mp4 | Massage in serene bedroom, candles | 15-20s raw / 8s display | MP4 + WebM | <4MB each | `/public/videos/hero/` |
| hero-bridal.mp4 | Bridal prep, multiple professionals | 15-20s raw / 8s display | MP4 + WebM | <4MB each | `/public/videos/hero/` |
| brand-story.mp4 | Service montage (facial, massage, hair, bridal) | 15-30s | MP4 + WebM | <8MB | `/public/videos/` |
| 4 poster images | Keyframe thumbnails from each video | -- | WebP + JPEG | <150KB each | `/public/images/hero/` |

**Video encoding**: 1080p desktop (4-6 Mbps), 720p mobile (2-3 Mbps). Color grade: warm midtones, deep shadows, gold highlights.

---

## 5. Image Assets Required

### Existing (reuse from `/public/images/categories/`)
- waxing.jpg, facials.jpg, threading.jpg, hair-spa.jpg, manicure-pedicure.jpg, bleach.jpg

### New (need to create/source)
| Image | Dimensions | Location |
|-------|-----------|----------|
| salon-at-home.jpg | 800x600 min | `/public/images/services-showcase/` |
| spa-body.jpg | 800x600 min | `/public/images/services-showcase/` |
| bridal-special.jpg | 800x600 min | `/public/images/services-showcase/` |
| promo-facial.jpg | 800x600 min | `/public/images/promos/` |
| promo-bridal.jpg | 800x600 min | `/public/images/promos/` |
| booking-cta.jpg | 800x600 min | `/public/images/` |

---

## 6. Migration Plan

| Phase | Action | Risk |
|-------|--------|------|
| **1. Build** | Create all 14 components in `/src/components/landing/`. Zero changes to existing code. | None |
| **2. Route Groups** | Create `/src/app/(landing)/page.tsx` and `/src/app/(landing)/layout.tsx`. Move current page.tsx to `/src/app/(app)/page.tsx`. | Low -- route groups don't change URLs |
| **3. Landing Layout** | Landing layout: no BottomNav, no app shell, custom StickyNav. App layout: existing behavior unchanged. | Low |
| **4. Auth Routing** | Middleware or client-side: unauthenticated -> landing, authenticated -> app homepage. | Medium -- test both flows |
| **5. QA + Launch** | Cross-browser testing, performance audit, mobile QA. | Low |

**Critical constraint**: Existing pages (/services, /booking, /cart, /auth, /customer, /offers, /about, /contact, /blog, /help, /terms, /privacy, /partner, /referral) must NOT change. The landing page only replaces `/` for unauthenticated visitors.

---

## 7. Performance Budget

| Metric | Target |
|--------|--------|
| **LCP** | < 2.5s (hero poster image as LCP element) |
| **CLS** | 0 (all sections have explicit dimensions / aspect-ratios) |
| **FID / INP** | < 100ms |
| **Total Page Weight** | < 3MB initial load (first hero video + all HTML/CSS/JS) |
| **Lighthouse** | > 90 across Performance, Accessibility, Best Practices, SEO |
| **Video Strategy** | Preload first video only. Lazy-load others on scroll via IntersectionObserver. |
| **Image Strategy** | next/image with blur placeholders. `loading="lazy"` for below-fold. |
| **Font Strategy** | Preload brand serif font via `<link rel="preload">`. System sans-serif for body. |
| **Reduced Motion** | All animations disabled. Static poster images. No auto-advance. |

---

## 8. Implementation Sprints

### Sprint 1: Core Layout (5-7 days)
| Component | Type | Agent | Dependencies |
|-----------|------|-------|-------------|
| StickyNav | Client | Agent 1 | framer-motion (scroll), Lucide icons |
| HeroVideoCarousel | Client | Agent 1 | framer-motion (AnimatePresence, crossfade) |
| StatsCounter | Client | Agent 2 | framer-motion (useInView), useCountUp hook |
| ServiceShowcase | Server | Agent 2 | next/image, existing category images |
| Landing page + layout | -- | Agent 3 | Route groups, middleware |

### Sprint 2: Content Sections (5-7 days)
| Component | Type | Agent | Dependencies |
|-----------|------|-------|-------------|
| PromoBanners | Server | Agent 4 | next/image |
| BrandStory | Client | Agent 4 | framer-motion (useInView), video |
| TrustBadges | Server | Agent 5 | Lucide icons |
| ReviewsCarousel | Client | Agent 5 | framer-motion (drag, animate), static data |

### Sprint 3: Footer + Polish (5-7 days)
| Component | Type | Agent | Dependencies |
|-----------|------|-------|-------------|
| BookingCTA | Client | Agent 6 | react-hook-form, zod |
| FAQAccordion | Client | Agent 6 | @radix-ui/react-accordion |
| SEOContent | Client | Agent 7 | -- |
| LandingFooter | Server | Agent 7 | -- |
| WhatsAppButton | Client | Agent 7 | -- |
| BackToTop | Client | Agent 7 | -- |

---

## 9. Testing Checklist

### Responsive Breakpoints
- 375px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1024px (iPad Pro), 1440px (Desktop), 1920px (Large Desktop)

### Video Autoplay
- iOS Safari (must use `playsinline muted`)
- Chrome Android
- Chrome Desktop
- Firefox Desktop
- Samsung Internet

### Interactions
- Carousel dot click + keyboard (Arrow keys, Enter, Space)
- FAQ accordion open/close + keyboard (Enter, Space, Arrow keys)
- Review carousel swipe on touch + arrow click on desktop
- Mobile hamburger menu open/close + Escape key
- WhatsApp button click + tooltip
- Back to Top smooth scroll
- CTA form validation (empty, invalid phone, success)

### Performance
- Lighthouse >= 90 all categories
- LCP < 2.5s on 4G throttled
- No layout shift (CLS = 0)
- Video loads only when visible
- `prefers-reduced-motion` disables all animation

### Accessibility
- Skip-to-content link
- All images have alt text
- All interactive elements have focus rings
- Carousel has ARIA roledescription + live region
- FAQ accordion keyboard navigable
- Color contrast >= 4.5:1 (AA) for all text
- Mobile menu focus trap

---

## 10. Detailed Section Specs (Reference Files)

For complete pixel-level specifications, content copy, and interaction details, agents should read the relevant section file:

| Section | File | Lines |
|---------|------|-------|
| Hero + Navigation | [PRD-SECTION-1-HERO-NAV.md](PRD-SECTION-1-HERO-NAV.md) | 782 |
| Stats + Services | [PRD-SECTION-2-STATS-SERVICES.md](PRD-SECTION-2-STATS-SERVICES.md) | 559 |
| Promos + Brand | [PRD-SECTION-3-PROMOS-BRAND.md](PRD-SECTION-3-PROMOS-BRAND.md) | 345 |
| Reviews + Social | [PRD-SECTION-4-REVIEWS-SOCIAL.md](PRD-SECTION-4-REVIEWS-SOCIAL.md) | 480 |
| Footer + CTA | [PRD-SECTION-5-FOOTER-CTA.md](PRD-SECTION-5-FOOTER-CTA.md) | 600 |
| Architecture | [PRD-SECTION-6-ARCHITECTURE.md](PRD-SECTION-6-ARCHITECTURE.md) | 991 |

**Total PRD**: ~3,757 lines across 7 files.

---

## 11. Agent Execution Protocol

When launching agents to build this landing page, each agent MUST:

1. **Read this master PRD first** for tech stack, architecture, and constraints
2. **Read their specific section file** for pixel-level specs and content
3. **Install framer-motion** if not already installed (`npm install framer-motion`)
4. **Use `'use client'`** only on interactive components (see component map above)
5. **Use existing Tailwind design tokens** (brand-maroon-*, brand-gold-*, shadow-*, etc.)
6. **Use Lucide React** for all icons (already installed, strokeWidth 1.5)
7. **Use next/image** for all images with `sizes` prop and blur placeholders
8. **No console.log** -- use `logger` from `@/lib/logger`
9. **No emojis** in any code, content, or comments
10. **Place all components** in `/src/components/landing/`
11. **Place all static content** in `/src/data/landing-content.ts`
12. **Follow existing patterns** from `/src/components/home/` for SSR safety (`hasMounted`)

---

*This PRD is the single source of truth for the Glamornate landing page redesign. All implementation agents operate from this document and its 6 section files.*
