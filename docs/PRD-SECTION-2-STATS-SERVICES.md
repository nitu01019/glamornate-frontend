# PRD Section 2 -- Milestones/Stats Counter + Services Showcase

**Project:** Glamornate Website Redesign
**Section:** Stats Counter Bar + Services Showcase (below hero)
**Reference:** Yes Madam homepage pattern
**Last updated:** 2026-04-10

---

## Table of Contents

1. [Overview](#1-overview)
2. [Stats Counter Section](#2-stats-counter-section)
3. [Large Service Category Cards](#3-large-service-category-cards)
4. [Small Category Circles](#4-small-category-circles)
5. [CTA Button](#5-cta-button)
6. [Section Spacing and Layout](#6-section-spacing-and-layout)
7. [Responsive Behavior](#7-responsive-behavior)
8. [Content Specification](#8-content-specification)
9. [Accessibility](#9-accessibility)
10. [Implementation Notes](#10-implementation-notes)

---

## 1. Overview

This section sits directly below the hero banner and above the existing category grid. It serves two purposes:

1. **Social proof** -- A horizontal row of milestone statistics that establishes credibility (trained professionals, happy customers, services delivered, city presence, rating).
2. **Service discovery** -- A curated showcase of Glamornate's service categories split into three large "hero" cards for top-level groupings and six small circular icons for individual categories, ending with a single call-to-action that drives users deeper into the catalog.

### Placement in Page Hierarchy

```
LocationHeader
SearchBar
HeroBanner
EliteBanner
--> StatsCounterBar        (NEW -- this PRD)
--> ServicesShowcase        (NEW -- this PRD)
NewCategoriesGrid          (existing -- may be removed or kept below)
HomePageClient (Most Booked)
PromoSection
BrandFooter
```

---

## 2. Stats Counter Section

### 2.1 Layout

| Viewport | Layout | Scroll |
|----------|--------|--------|
| Desktop (>= 1024px) | Single flex row, evenly spaced across `max-w-5xl` container, centered | No scroll |
| Tablet (768-1023px) | Single flex row, items shrink proportionally | No scroll |
| Mobile (< 768px) | Horizontal scroll, `overflow-x: auto`, hidden scrollbar | Snap scroll (`scroll-snap-type: x mandatory`) |

- **Container:** Full-width `section` with `bg-white` background
- **Inner wrapper:** `max-w-5xl mx-auto` on desktop; `px-4` horizontal padding on all viewports
- **Item count:** 5 stat items arranged in a single row
- **Item alignment:** Each item is a vertical stack -- icon on top, number in the middle, label below -- all center-aligned
- **Gap between items:** `gap-8` (32px) on desktop; `gap-6` (24px) on mobile scroll items
- **Dividers:** A thin 1px vertical line (`border-r border-gray-200`) separates each item on desktop/tablet. On mobile, dividers are hidden to keep the scroll compact.

### 2.2 Stat Item Structure

Each stat item is a flex column with these child elements stacked vertically and centered:

```
[Icon Circle]      -- 56x56px circle with icon inside
[Animated Number]  -- Large bold count-up number
[Label]            -- Small muted description text
```

### 2.3 Icon Design

- **Shape:** Circle, 56x56px (`w-14 h-14`)
- **Background:** `bg-brand-maroon-50` (#FDF2F8, the lightest maroon tint from the existing palette)
- **Border:** `border border-brand-maroon-100` (subtle definition)
- **Icon inside:** 24x24px outline-style icon from Lucide React, colored `text-brand-maroon-500` (#880E4F)
- **Icon selection per stat:**
  - "500+ Trained Professionals" -- `Users` icon (group of people)
  - "50K+ Happy Customers" -- `Heart` icon (satisfaction)
  - "100K+ Services Delivered" -- `Sparkles` icon (completed services)
  - "Jammu & Delhi NCR" -- `MapPin` icon (location)
  - "4.9 Customer Rating" -- `Star` icon (filled star)

### 2.4 Count-Up Animation

The numeric values animate from 0 to their target when the section first scrolls into the viewport. This runs once and does not replay.

| Parameter | Value |
|-----------|-------|
| **Trigger** | Intersection Observer, `threshold: 0.3` (fires when 30% of the section is visible) |
| **Duration** | 2000ms (2 seconds) |
| **Easing** | `easeOutExpo` -- fast start, gradual deceleration. Cubic bezier approximation: `cubic-bezier(0.16, 1, 0.3, 1)` |
| **Start value** | 0 |
| **End value** | The target number (500, 50000, 100000, n/a for city text, 4.9) |
| **Frame update** | `requestAnimationFrame` loop, updating displayed value each frame |
| **Number formatting** | Use `Intl.NumberFormat('en-IN')` for locale-appropriate comma separation. Append `+` suffix after the number for the first three stats. The rating stat displays as `4.9` with a star unicode character. |
| **Reduced motion** | When `prefers-reduced-motion: reduce` is active, skip animation entirely and display the final value immediately |
| **Non-numeric stat** | "Jammu & Delhi NCR" does not count up -- it fades in with `opacity 0 -> 1` over 600ms using the same Intersection Observer trigger |

**Implementation approach:** A custom `useCountUp(target, duration, shouldAnimate)` hook that returns the current display value. The hook starts a `requestAnimationFrame` loop when `shouldAnimate` flips to `true` (set by the Intersection Observer callback). The easing function maps elapsed time fraction `t` (0 to 1) to the output fraction via `1 - Math.pow(1 - t, 4)` (approximation of easeOutExpo).

### 2.5 Mobile Scroll Behavior

On viewports below 768px:

- Container has `overflow-x: auto` and the `scrollbar-hide` utility (already defined in globals.css)
- Each stat item has `flex-shrink-0` and a fixed width of `min-w-[140px]`
- Scroll snapping: `scroll-snap-type: x mandatory` on the container, `scroll-snap-align: start` on each item
- Left/right padding of `px-4` on the scroll container so the first and last items are not flush with the screen edge
- No horizontal scroll indicators or arrows -- the slight peek of the next item signals scrollability

---

## 3. Large Service Category Cards

### 3.1 Overview

Three large cards displayed in a row, each representing a high-level service grouping. These group Glamornate's 13 catalog categories into three consumer-friendly themes.

### 3.2 Card Mapping to Catalog Categories

| Card Title | Catalog categories included | Link target |
|------------|---------------------------|-------------|
| Salon at Home | Waxing, Facials (facials + clean-ups), Threading, Bleach, De-Tan Pack | `/services?group=salon` |
| Spa & Body Treatments | Manicure & Pedicure, Body Polishing & Massage, Hair Spa, Hair Treatments | `/services?group=spa` |
| Bridal & Special Occasions | Hair Root Touch Up, Global Hair Coloring, Hair Transformation (plus Bridal packages when added) | `/services?group=bridal` |

### 3.3 Layout

| Viewport | Layout |
|----------|--------|
| Desktop (>= 1024px) | 3 cards in a flex row, each `flex-1`, equal width, `gap-8` (32px) between cards |
| Tablet (768-1023px) | 3 cards in a flex row, `gap-6` (24px) |
| Mobile (< 768px) | Vertical stack, each card full width, `gap-6` (24px) between cards |

- **Container:** `max-w-5xl mx-auto px-4`
- **Section title:** "Services We Offer" -- see typography spec below

### 3.4 Card Dimensions and Structure

```
+------------------------------------------+
|                                          |
|       [Decorative Blob Background]       |
|            [Oval/Circular Image]         |
|                                          |
|           [Title]                        |
|           [Description paragraph]        |
|                                          |
+------------------------------------------+
```

| Property | Value |
|----------|-------|
| **Card width** | Flexible (`flex-1` on desktop, `w-full` on mobile) |
| **Card min-height** | 380px desktop, 340px mobile |
| **Card padding** | `p-8` (32px) desktop, `p-6` (24px) mobile |
| **Border radius** | `rounded-2xl` (16px) |
| **Background** | `bg-white` |
| **Border** | `border border-gray-100` |
| **Shadow** | `shadow-card-sm` at rest (existing utility) |
| **Click target** | The entire card is a single `<Link>` element wrapping all content. Cursor shows pointer on hover. |

### 3.5 Image Treatment

- **Shape:** Oval crop using `rounded-full` on a container sized `w-48 h-56` (192x224px) on desktop, `w-40 h-48` (160x192px) on mobile
- **Position:** Centered horizontally within the card, top portion
- **Object fit:** `object-cover` on the `<Image>` element inside the oval container
- **Image source:** Placeholder paths `/images/services-showcase/salon-at-home.jpg`, `/images/services-showcase/spa-body.jpg`, `/images/services-showcase/bridal-special.jpg` -- actual images to be provided by design team
- **Decorative blob:** An absolutely-positioned `div` behind the image with these properties:
  - **Shape:** Organic blob using `border-radius: 60% 40% 50% 50% / 50% 60% 40% 50%` (irregular rounded shape)
  - **Size:** Slightly larger than the image container -- `w-56 h-64` (224x256px) on desktop
  - **Position:** `absolute`, centered behind the image, offset slightly down-right (`top-2 left-2`) for visual interest
  - **Colors per card:**
    - Salon at Home: `bg-brand-maroon-500/10` (maroon at 10% opacity)
    - Spa & Body Treatments: `bg-brand-gold-500/10` (gold at 10% opacity)
    - Bridal & Special Occasions: `bg-brand-maroon-400/10` (lighter maroon at 10% opacity -- giving a slight lavender/rose tint to parallel Yes Madam's lavender blob)
  - **Z-index:** `z-0` (behind the image which is `z-10`)

### 3.6 Title Typography

| Property | Value |
|----------|-------|
| **Font** | `font-sans` (Inter via CSS variable) |
| **Weight** | `font-bold` (700) |
| **Size** | `text-xl` (20px) on desktop, `text-lg` (18px) on mobile |
| **Color** | `text-gray-900` |
| **Margin** | `mt-6` (24px) above, `mb-2` (8px) below |
| **Alignment** | `text-center` |

### 3.7 Description Text

| Property | Value |
|----------|-------|
| **Font** | `font-sans` (Inter) |
| **Weight** | `font-normal` (400) |
| **Size** | `text-sm` (14px) |
| **Color** | `text-gray-500` |
| **Line height** | `leading-relaxed` (1.625) |
| **Max lines** | 3 lines, enforced by `line-clamp-3` |
| **Alignment** | `text-center` |

### 3.8 Hover Effects

All transitions use `transition-all duration-300 ease-out`:

| Effect | At rest | On hover |
|--------|---------|----------|
| **Shadow** | `shadow-card-sm` | `shadow-card-hover` (existing utility -- deeper shadow) |
| **Transform** | `translateY(0)` | `translateY(-4px)` (slight lift via `-translate-y-1`) |
| **Border** | `border-gray-100` | `border-brand-maroon-100` (subtle maroon tint) |
| **Image scale** | `scale(1)` | `scale(1.05)` (slight zoom on the image only, with `overflow-hidden` on the oval container to clip) |

---

## 4. Small Category Circles

### 4.1 Overview

Six circular image icons with labels, representing specific service categories from the Glamornate catalog. These sit below the three large cards and above the CTA button.

### 4.2 Category Mapping

| Circle Label | Catalog slug | Image path |
|--------------|-------------|------------|
| Waxing | `waxing` | `/images/categories/waxing.jpg` |
| Facials | `facials` | `/images/categories/facials.jpg` |
| Threading | `threading` | `/images/categories/threading.jpg` |
| Hair Services | `hair-spa` | `/images/categories/hair-spa.jpg` |
| Mani & Pedi | `manicure-pedicure` | `/images/categories/manicure-pedicure.jpg` |
| Bleach & Detan | `bleach` | `/images/categories/bleach.jpg` |

Each circle links to its category detail page: `/services/{slug}`.

### 4.3 Layout

| Viewport | Grid | Gap |
|----------|------|-----|
| Desktop (>= 1024px) | Single row, 6 columns (`grid-cols-6`) | `gap-8` (32px) |
| Tablet (768-1023px) | Single row, 6 columns (`grid-cols-6`) | `gap-6` (24px) |
| Mobile (< 768px) | 3 columns, 2 rows (`grid-cols-3`) | `gap-x-6 gap-y-6` (24px both axes) |

- **Container:** Same `max-w-5xl mx-auto px-4` wrapper as the large cards
- **Margin above:** `mt-10` (40px) from the large cards section
- **Item alignment:** Each item centered within its grid cell

### 4.4 Circle Image Spec

| Property | Value |
|----------|-------|
| **Container size** | `w-20 h-20` (80x80px) on desktop, `w-16 h-16` (64x64px) on mobile |
| **Shape** | `rounded-full` (perfect circle) |
| **Overflow** | `overflow-hidden` (clips the image to the circle) |
| **Border** | `border-2 border-white` plus `shadow-card-sm` for a subtle raised look |
| **Image** | `<Image>` with `fill`, `object-cover`, `sizes="80px"` |
| **Background** | `bg-gray-100` (placeholder while loading) |

### 4.5 Label Below Circle

| Property | Value |
|----------|-------|
| **Font** | `font-sans` (Inter) |
| **Weight** | `font-medium` (500) |
| **Size** | `text-xs` (12px) on desktop, `text-[11px]` on mobile |
| **Color** | `text-gray-700` |
| **Margin** | `mt-2` (8px) above |
| **Alignment** | `text-center` |
| **Max lines** | 2, via `line-clamp-2` with `leading-tight` |

### 4.6 Hover and Active Effects

| Effect | At rest | On hover / active |
|--------|---------|-------------------|
| **Scale** | `scale(1)` | `scale(1.1)` on hover (desktop), `scale(0.95)` on active (mobile tap feedback) |
| **Shadow** | `shadow-card-sm` | `shadow-card-md` |
| **Label color** | `text-gray-700` | `text-brand-maroon-500` |
| **Transition** | -- | `transition-all duration-200 ease-out` |

---

## 5. CTA Button

### 5.1 Spec

| Property | Value |
|----------|-------|
| **Text** | "Explore All Services" |
| **Link** | `/services` |
| **Element** | `<Link>` styled as a button |
| **Alignment** | Centered horizontally (`flex justify-center`) |
| **Margin above** | `mt-10` (40px) from the small category circles |
| **Padding** | `px-8 py-3.5` (32px horizontal, 14px vertical) |
| **Background** | `bg-brand-maroon-500` (#880E4F) |
| **Text color** | `text-white` |
| **Font** | `font-sans`, `font-semibold`, `text-base` (16px) |
| **Border radius** | `rounded-full` (pill shape) |
| **Shadow** | `shadow-maroon` (existing utility: `0 4px 14px 0 rgba(136, 14, 79, 0.15)`) |
| **Hover background** | `bg-brand-maroon-600` (#7B0C47) |
| **Hover shadow** | `shadow-maroon-lg` (existing utility: `0 10px 40px -10px rgba(136, 14, 79, 0.3)`) |
| **Hover transform** | `scale(1.02)` (slight grow) |
| **Transition** | `transition-all duration-200 ease-out` |
| **Focus** | Uses existing `focus-ring` utility from globals.css |
| **Min touch target** | Inherently met -- button size exceeds 44x44px |

### 5.2 Optional Right Arrow Icon

A `ChevronRight` icon (Lucide, 20x20px) can be placed after the text for a directional affordance:

```
[ Explore All Services  > ]
```

- Icon color: `text-white/80`
- Spacing: `ml-2` (8px) left margin from text
- Hover: icon shifts right by 2px via `group-hover:translate-x-0.5`

---

## 6. Section Spacing and Layout

### 6.1 Overall Section Wrapper

The Stats Counter and Services Showcase form a single logical section but are implemented as two sibling components for separation of concerns.

```
<section id="stats-counter">
  ... stats bar ...
</section>

<div className="h-2 bg-section-bg" />   <!-- grey divider -->

<section id="services-showcase">
  <h2>Services We Offer</h2>
  ... large cards ...
  ... small circles ...
  ... CTA button ...
</section>
```

### 6.2 Section Title ("Services We Offer")

| Property | Value |
|----------|-------|
| **Tag** | `<h2>` |
| **Text** | "Services We Offer" |
| **Font** | `font-sans`, `font-bold`, `text-2xl` (24px) on desktop, `text-xl` (20px) on mobile |
| **Color** | `text-gray-900` |
| **Alignment** | `text-center` |
| **Margin below** | `mb-10` (40px) on desktop, `mb-8` (32px) on mobile |
| **Optional subtitle** | "Premium beauty & wellness services delivered to your doorstep" |
| **Subtitle font** | `text-sm text-gray-500 font-normal mt-2` |

### 6.3 Spacing Table

| Element | Top spacing | Bottom spacing |
|---------|------------|----------------|
| Stats Counter section | `py-10` (40px top and bottom) desktop; `py-8` (32px) mobile | -- |
| Grey divider between stats and services | `h-2` (8px) with `bg-section-bg` | -- |
| Services Showcase section | `pt-12 pb-16` (48px top, 64px bottom) desktop; `pt-8 pb-12` (32px top, 48px bottom) mobile | -- |
| Section title to large cards | -- | `mb-10` (40px) |
| Large cards to small circles | -- | `mt-10` (40px) |
| Small circles to CTA button | -- | `mt-10` (40px) |
| CTA button to section end | -- | Covered by section `pb-16` / `pb-12` |

### 6.4 Max Width Container

All content within both sections uses:

```
<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
```

- `max-w-5xl` = 1024px max content width (matches existing Tailwind `container` of 1400px with inner tighter constraint for this section)
- `px-4` (16px) mobile, `px-6` (24px) tablet, `px-8` (32px) desktop side padding

---

## 7. Responsive Behavior

### 7.1 Breakpoint Summary

| Component | Mobile (< 768px) | Tablet (768-1023px) | Desktop (>= 1024px) |
|-----------|-------------------|--------------------|--------------------|
| Stats bar | Horizontal scroll, snap, `min-w-[140px]` per item | Flex row, items shrink | Flex row, evenly spaced |
| Stats dividers | Hidden | Visible (`border-r`) | Visible (`border-r`) |
| Stats icon size | `w-12 h-12` (48px) | `w-14 h-14` (56px) | `w-14 h-14` (56px) |
| Stats number size | `text-xl` (20px) | `text-2xl` (24px) | `text-2xl` (24px) |
| Large cards | Vertical stack, full width | 3 columns, `gap-6` | 3 columns, `gap-8` |
| Card image oval | `w-40 h-48` | `w-44 h-52` | `w-48 h-56` |
| Card min-height | 340px | 360px | 380px |
| Small circles | `grid-cols-3`, 2 rows | `grid-cols-6`, 1 row | `grid-cols-6`, 1 row |
| Circle size | `w-16 h-16` (64px) | `w-18 h-18` (72px) | `w-20 h-20` (80px) |
| CTA button | Full width (`w-full`) | Auto width, centered | Auto width, centered |

### 7.2 Mobile-Specific Adjustments

- **Stats bar:** Add `12px` scroll-padding-left (`scroll-pl-3`) so the first item does not start at the absolute left edge. The last item has a trailing `pr-4` spacer.
- **Large cards on mobile:** Cards switch from side-by-side to a vertical stack. The decorative blob shrinks proportionally. Card internal padding reduces from 32px to 24px.
- **CTA button on mobile:** Stretches to full width of the container (`w-full` within `px-4`) for easier tap target.
- **Touch feedback:** All interactive elements (cards, circles, CTA) use `active:scale-95` for mobile press feedback alongside the desktop hover effects.

---

## 8. Content Specification

### 8.1 Stats Content

| # | Icon (Lucide) | Animated Number | Display Format | Label |
|---|---------------|----------------|----------------|-------|
| 1 | `Users` | 500 | "500+" | "Trained Professionals" |
| 2 | `Heart` | 50000 | "50K+" | "Happy Customers" |
| 3 | `Sparkles` | 100000 | "100K+" | "Services Delivered" |
| 4 | `MapPin` | (no count-up) | "Jammu & Delhi NCR" | "Cities We Serve" |
| 5 | `Star` | 4.9 | "4.9" with filled star | "Customer Rating" |

**Number formatting rules:**
- Stats 1: display as `"500+"` (no abbreviation needed)
- Stats 2: display as `"50K+"` (abbreviate thousands with "K")
- Stats 3: display as `"100K+"` (abbreviate thousands with "K")
- Stats 4: display raw text `"Jammu & Delhi NCR"`, no count-up, fade-in only
- Stats 5: display as `"4.9"` followed by a gold star icon, `text-brand-gold-500`

### 8.2 Large Service Card Content

**Card 1: Salon at Home**
- **Title:** "Salon at Home"
- **Description:** "Professional salon services at your doorstep. From waxing and facials to threading and bleach -- expert beauticians bring the full salon experience to you."
- **Image:** `/images/services-showcase/salon-at-home.jpg`
- **Blob color:** `bg-brand-maroon-500/10`
- **Link:** `/services?group=salon`

**Card 2: Spa & Body Treatments**
- **Title:** "Spa & Body Treatments"
- **Description:** "Indulge in relaxing body polishing, massages, mani-pedi combos, and revitalizing hair spa treatments. Luxury wellness without leaving home."
- **Image:** `/images/services-showcase/spa-body.jpg`
- **Blob color:** `bg-brand-gold-500/10`
- **Link:** `/services?group=spa`

**Card 3: Bridal & Special Occasions**
- **Title:** "Bridal & Special Occasions"
- **Description:** "Complete bridal and pre-wedding packages including hair transformations, global coloring, and premium styling. Look your absolute best on your special day."
- **Image:** `/images/services-showcase/bridal-special.jpg`
- **Blob color:** `bg-brand-maroon-400/10`
- **Link:** `/services?group=bridal`

### 8.3 Small Category Circle Content

| # | Label | Slug | Image Path | Link |
|---|-------|------|------------|------|
| 1 | Waxing | `waxing` | `/images/categories/waxing.jpg` | `/services/waxing` |
| 2 | Facials | `facials` | `/images/categories/facials.jpg` | `/services/facials` |
| 3 | Threading | `threading` | `/images/categories/threading.jpg` | `/services/threading` |
| 4 | Hair Services | `hair-spa` | `/images/categories/hair-spa.jpg` | `/services/hair-spa` |
| 5 | Mani & Pedi | `manicure-pedicure` | `/images/categories/manicure-pedicure.jpg` | `/services/manicure-pedicure` |
| 6 | Bleach & Detan | `bleach` | `/images/categories/bleach.jpg` | `/services/bleach` |

### 8.4 CTA Button Content

- **Text:** "Explore All Services"
- **Link:** `/services`

---

## 9. Accessibility

### 9.1 Semantic HTML

- Stats section uses `<section aria-labelledby="stats-heading">` with a visually hidden `<h2 id="stats-heading">Our Milestones</h2>` (using `sr-only` class)
- Services section uses `<section aria-labelledby="services-heading">` with the visible `<h2 id="services-heading">Services We Offer</h2>`
- Each large card is a `<Link>` element (semantic anchor) with `aria-label` providing the full card context, e.g., `aria-label="Salon at Home - Professional salon services at your doorstep"`
- Each small circle is a `<Link>` with the category name as accessible text

### 9.2 Count-Up Animation

- Animated numbers use `aria-live="polite"` on the number container so screen readers announce the final value
- The displayed text value is always present in the DOM (the animation is visual only -- the final value is set as the element's text content from the start for screen readers, and the visual count-up overlays it)
- `prefers-reduced-motion: reduce` disables all count-up and fade-in animations

### 9.3 Focus Management

- All interactive elements (cards, circles, CTA) use the existing `focus-ring` utility: `focus-visible:ring-2 ring-brand-maroon-500 ring-offset-2`
- Tab order follows visual order: stats (not focusable individually, they are informational), then large cards left to right, then small circles left to right, then CTA button

### 9.4 Mobile Scroll

- The horizontally scrollable stats bar on mobile includes `role="region"` and `aria-label="Milestone statistics"` so screen readers identify it as a scrollable region
- `tabindex="0"` on the scroll container allows keyboard users to focus it and scroll with arrow keys

### 9.5 Image Alt Text

- Large card images: descriptive alt text, e.g., `alt="Woman receiving salon services at home"`
- Small circle images: category name as alt text, e.g., `alt="Waxing services"`
- Decorative blobs have `aria-hidden="true"` since they are purely visual

---

## 10. Implementation Notes

### 10.1 Component File Structure

```
src/components/home/
  StatsCounterBar.tsx          -- Stats section with count-up
  ServicesShowcase.tsx          -- Wrapper: title + large cards + small circles + CTA
  ServiceShowcaseCard.tsx       -- Individual large card component
  CategoryCircle.tsx            -- Individual small circle component

src/hooks/
  useCountUp.ts                -- Custom hook for count-up animation
  useIntersectionObserver.ts   -- Reusable Intersection Observer hook (if not already present)
```

### 10.2 Data Constants

Define a `STATS_DATA` array and `SHOWCASE_CARDS` array as constants in the component files or a shared data file. Do not fetch these from the backend -- they are static marketing content.

### 10.3 Images Required

The following images must be created/sourced before implementation:

**For large cards (new assets needed):**
- `/public/images/services-showcase/salon-at-home.jpg` -- Woman receiving salon treatment, warm lighting
- `/public/images/services-showcase/spa-body.jpg` -- Spa/body treatment scene, relaxing atmosphere
- `/public/images/services-showcase/bridal-special.jpg` -- Bridal preparation/styling scene

**For small circles (existing assets in catalog):**
- `/public/images/categories/waxing.jpg` -- already exists
- `/public/images/categories/facials.jpg` -- already exists
- `/public/images/categories/threading.jpg` -- already exists
- `/public/images/categories/hair-spa.jpg` -- already exists
- `/public/images/categories/manicure-pedicure.jpg` -- already exists
- `/public/images/categories/bleach.jpg` -- already exists

### 10.4 Tailwind Config Dependencies

All colors, shadows, animations, and utilities referenced in this PRD already exist in the project's `tailwind.config.ts` and `globals.css`. No Tailwind config changes are required. The following existing utilities are used:

- Colors: `brand-maroon-*`, `brand-gold-*`, `section-bg`
- Shadows: `shadow-card-sm`, `shadow-card-md`, `shadow-card-hover`, `shadow-maroon`, `shadow-maroon-lg`
- Animations: `animate-fade-in`, delay utilities (`delay-100` through `delay-500`)
- Utilities: `scrollbar-hide`, `focus-ring`, `touch-target`, `section-padding`

### 10.5 Performance Considerations

- **Images:** Use Next.js `<Image>` component with `priority={false}` (these are below the fold). Provide `sizes` prop for responsive loading. Use `placeholder="blur"` with blur data from the existing `blur-data.json` generation pipeline if available.
- **Count-up animation:** The `requestAnimationFrame` loop is lightweight. The Intersection Observer disconnects after the first trigger to avoid unnecessary observation.
- **No layout shift:** All containers have explicit dimensions or `min-h` to prevent Cumulative Layout Shift during image loading.

### 10.6 Integration with Existing Services Pages

The large cards link to `/services?group=salon|spa|bridal`. This requires the existing `/services` page to support an optional `group` query parameter for filtering. If filtering is not yet implemented, the cards should fall back to linking to `/services` with no query parameter until the filter is built.

The small circles link to `/services/{slug}`, which already works via the existing `src/app/services/[slug]/page.tsx` dynamic route.
