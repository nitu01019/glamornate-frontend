# PRD Section 3 -- Promotional Banners + Brand Story Section

**Product**: Glamornate Website Redesign
**Section**: 3 of N -- Promotional Banners & Brand Story
**Last Updated**: 2026-04-10
**Status**: Draft

---

## 3.1 Overview

This section defines two homepage modules that sit below the service categories and above the testimonials/footer region:

1. **Promotional Banners** -- a 2-column grid of visually rich, gradient-backed cards that spotlight key service categories and drive traffic to booking flows.
2. **Brand Story Section** -- a full-width narrative block with branded wordmark, short copy, CTA, and an auto-playing video showcasing the Glamornate experience.

Together they accomplish two goals: (a) surface high-intent entry points for top-revenue services (facials, bridal), and (b) build brand trust and emotional connection through storytelling and video.

---

## 3.2 Promotional Banners

### 3.2.1 Layout

| Property | Desktop (>=768px) | Mobile (<768px) |
|---|---|---|
| Grid | `grid grid-cols-2 gap-6` | `grid grid-cols-1 gap-4` |
| Container | `max-w-6xl mx-auto px-4` | Full-width with `px-4` side padding |
| Card height | Min 280px, auto-stretch to equal height | Min 220px, auto |
| Card border-radius | `rounded-2xl` (16px) | `rounded-2xl` (16px) |
| Card overflow | `overflow-hidden` (clips image bleed) | Same |
| Card position | `relative` (for absolute-positioned image) | Same |
| Internal padding | `p-8` (left content area) | `p-6` |
| Section spacing | `py-12 md:py-16` above/below the grid | Same |

### 3.2.2 Card Structure (Both Banners)

Each card is a single `<Link>` element wrapping the entire card for full-surface clickability. Internal layout uses flexbox:

```
+-----------------------------------------------+
|  [Gradient Background]                         |
|                                                |
|  Heading (text)          [Service Image]       |
|  Description (text)       (right-aligned,      |
|                            overlapping edge)   |
|  [CTA Button]                                  |
|                                                |
|  [Decorative blob/curve — CSS pseudo-element]  |
+-----------------------------------------------+
```

- **Text column**: Takes roughly 55-60% of the card width on desktop. Vertically centered with `flex flex-col justify-center`.
- **Image column**: Absolutely positioned, right-aligned. The image extends 10-15% beyond the card's right padding for an overlapping/cropped effect. `absolute right-0 bottom-0` with `w-[45%] h-full object-cover object-center`.
- **Decorative blob**: A `::before` pseudo-element with `border-radius: 50%`, 120px diameter, positioned top-right at 15% opacity using the card's lighter gradient color. Adds visual richness without competing with content.

### 3.2.3 Banner A -- Premium Facials

| Property | Value |
|---|---|
| **Route link** | `/services/facials-cleanups` |
| **Background gradient** | `linear-gradient(135deg, #880E4F 0%, #6D0A3E 60%, #4A062A 100%)` (maroon-to-deep-maroon) |
| **Heading** | "Premium Facials at Your Doorstep" |
| **Heading style** | `text-2xl md:text-3xl font-bold text-white leading-tight` |
| **Description** | "Expert facial treatments and cleanups delivered to your home in Jammu. Glow without the commute." |
| **Description style** | `text-sm md:text-base text-white/80 mt-3 max-w-[28ch]` |
| **CTA text** | "Book a Facial" |
| **CTA style** | `bg-brand-gold-500 hover:bg-brand-gold-600 text-brand-maroon-900 font-semibold px-6 py-2.5 rounded-lg mt-6 inline-flex items-center gap-2 transition-all duration-200 shadow-gold` |
| **CTA icon** | Right arrow (`ArrowRight` from lucide-react, 16px) |
| **Image** | High-quality photo of a woman receiving a facial treatment. Warm tones. Minimum source resolution 800x600. Format: WebP with JPEG fallback. |
| **Image alt** | "Professional facial treatment at home" |
| **Decorative blob color** | `rgba(255, 215, 0, 0.12)` (gold at 12% opacity) |
| **Decorative blob position** | `top-[-30px] right-[-20px]`, 140px diameter |

### 3.2.4 Banner B -- Bridal Packages

| Property | Value |
|---|---|
| **Route link** | `/services/bridal-packages` |
| **Background gradient** | `linear-gradient(135deg, #FFD700 0%, #FEF9C3 50%, #FFFEF0 100%)` (gold-to-cream) |
| **Heading** | "Bridal Packages Tailored for You" |
| **Heading style** | `text-2xl md:text-3xl font-bold text-brand-maroon-900 leading-tight` |
| **Description** | "Complete bridal beauty prep -- from mehendi-ready hands to the perfect glow. Customised packages for your big day." |
| **Description style** | `text-sm md:text-base text-brand-maroon-700/80 mt-3 max-w-[28ch]` |
| **CTA text** | "Explore Bridal" |
| **CTA style** | `bg-brand-maroon-500 hover:bg-brand-maroon-600 text-white font-semibold px-6 py-2.5 rounded-lg mt-6 inline-flex items-center gap-2 transition-all duration-200 shadow-maroon` |
| **CTA icon** | Right arrow (`ArrowRight` from lucide-react, 16px) |
| **Image** | High-quality photo of bridal preparation (hands, makeup, or hair styling). Soft/warm tones. Minimum source resolution 800x600. Format: WebP with JPEG fallback. |
| **Image alt** | "Bridal beauty preparation services" |
| **Decorative blob color** | `rgba(136, 14, 79, 0.08)` (maroon at 8% opacity) |
| **Decorative blob position** | `bottom-[-20px] left-[-20px]`, 120px diameter |

### 3.2.5 Banner Interaction States

| State | Behaviour |
|---|---|
| **Default** | `shadow-card-sm` (subtle lift off background) |
| **Hover** | `hover:-translate-y-1 hover:shadow-card-hover` -- card lifts 4px and shadow deepens. Transition: `transition-all duration-300 ease-out`. |
| **Focus-visible** | `focus-visible:ring-2 focus-visible:ring-brand-maroon-500 focus-visible:ring-offset-2` |
| **Active/Press** | `active:scale-[0.98]` -- slight press-in on click/tap |
| **CTA hover** | Button scales up `hover:scale-[1.03]` and shadow intensifies. Arrow icon shifts right 2px via `group-hover:translate-x-0.5 transition-transform`. |
| **Reduced motion** | All transforms and transitions disabled via `prefers-reduced-motion: reduce` media query. Hover states fall back to opacity changes only. |

### 3.2.6 Banner Image Specifications

| Property | Value |
|---|---|
| Format | WebP (primary), JPEG (fallback via `<picture>` element or Next.js `Image`) |
| Dimensions (source) | 800 x 600px minimum |
| Aspect ratio (rendered) | Unconstrained; image fills right 45% of card via `object-cover` |
| Loading | `loading="lazy"`, `fetchPriority="low"` (banners are below the fold) |
| Placeholder | Blur placeholder via Next.js `Image` `placeholder="blur"` |
| Positioning | `object-position: center` for facial; `object-position: center top` for bridal |

---

## 3.3 Brand Story Section -- "The Glamornate Experience"

### 3.3.1 Section Layout

| Property | Value |
|---|---|
| **Width** | Full viewport width (`w-full`) |
| **Background** | Subtle maroon gradient at low opacity: `bg-gradient-to-br from-brand-maroon-50/50 via-white to-brand-gold-50/30`. Alternatively, a `::before` pseudo-element with `gradient-overlay-maroon` utility at 5% opacity. |
| **Padding** | `py-16 md:py-24` (matches `section-padding`) |
| **Content max-width** | `max-w-4xl mx-auto px-4` |
| **Text alignment** | Centered (`text-center`) |
| **Decorative element** | A soft circular blob (200px diameter) positioned `absolute left-[-60px] top-[20%]` at `rgba(136, 14, 79, 0.04)`. Visible on desktop only (`hidden md:block`). |

### 3.3.2 Branded Wordmark Heading

The heading "The Glamornate Experience" uses a split-color wordmark treatment:

```
The  [Glam]  [ornate]  Experience
     maroon   gold
```

| Element | Style |
|---|---|
| "The" | `text-brand-maroon-900 font-bold` |
| "Glam" | `text-brand-maroon-500 font-bold` (or `gradient-text-brand`) |
| "ornate" | `text-brand-gold-600 font-bold` (or `gradient-text-gold`) |
| "Experience" | `text-brand-maroon-900 font-bold` |
| Full heading | `text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight` |
| Spacing | `mb-6` below heading |

Implementation: use `<span>` elements within an `<h2>` to apply distinct color classes to each word segment.

### 3.3.3 Description Copy

**Text content:**

> "Glamornate brings the luxury salon experience to your doorstep in Jammu. From rejuvenating facials to complete bridal prep, our certified professionals deliver premium beauty services in the comfort of your home -- so you can look your best without stepping out."

| Property | Value |
|---|---|
| **Max width** | `max-w-[65ch] mx-auto` (optimal line length for readability) |
| **Font** | `text-base md:text-lg text-muted-foreground leading-relaxed` |
| **Spacing** | `mb-8` below description |

### 3.3.4 CTA Button

| Property | Value |
|---|---|
| **Text** | "Discover Our Story" |
| **Link** | `/about` |
| **Style** | `btn-gradient` utility class: `bg-gradient-to-r from-brand-gold-500 to-brand-maroon-500 text-white font-semibold px-8 py-3 rounded-lg shadow-lg shadow-brand-maroon-500/20` |
| **Hover** | `hover:from-brand-gold-600 hover:to-brand-maroon-600 hover:scale-[1.02] hover:shadow-brand-maroon-500/30` |
| **Focus** | `focus-visible:ring-2 focus-visible:ring-brand-maroon-500 focus-visible:ring-offset-2` |
| **Icon** | Optional sparkles or arrow icon trailing the text |
| **Spacing** | `mb-12 md:mb-16` below button (gap before video) |

### 3.3.5 Brand Video

The video auto-plays muted below the CTA, showcasing Glamornate services (facial treatments, massage, hair styling) in a polished montage.

| Property | Value |
|---|---|
| **Aspect ratio** | 16:9 (`aspect-video`) |
| **Max width** | `max-w-4xl mx-auto` (896px) |
| **Border radius** | `rounded-2xl` (16px) |
| **Shadow** | `shadow-card-lg` -- `0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)` |
| **Overflow** | `overflow-hidden` (clips video to rounded corners) |
| **Autoplay** | `autoPlay` attribute |
| **Muted** | `muted` attribute (required for autoplay in browsers) |
| **Loop** | `loop` attribute |
| **Plays inline** | `playsInline` attribute (prevents fullscreen on iOS) |
| **Poster image** | A keyframe thumbnail from the video. WebP format, same 16:9 ratio, displayed while video loads. `poster="/images/brand-video-poster.webp"` |
| **Preload** | `preload="metadata"` -- only loads enough to display poster and duration. Full video streams on visibility. |

#### Responsive Sizing

| Breakpoint | Behaviour |
|---|---|
| Mobile (<640px) | Video fills container width (`w-full`), `rounded-xl` (12px) |
| Tablet (640-1024px) | `max-w-2xl mx-auto` |
| Desktop (>=1024px) | `max-w-4xl mx-auto` |

#### Intersection Observer Behaviour

The video should only play when visible in the viewport to conserve resources and respect user attention:

```
- When >=50% of the video enters the viewport (threshold: 0.5):
    -> Call video.play()
- When <50% visible:
    -> Call video.pause()
- rootMargin: "0px" (no offset)
- Use a React ref + useEffect with IntersectionObserver
- Clean up observer on unmount
```

This pattern prevents the video from consuming bandwidth/CPU when scrolled off-screen.

#### Video Source

| Property | Value |
|---|---|
| **Primary format** | MP4 (H.264, `video/mp4`) |
| **Fallback format** | WebM (VP9, `video/webm`) -- provided via `<source>` elements |
| **Duration** | 15-30 seconds |
| **Resolution** | 1080p source, browser-adaptive |
| **File size target** | Under 8MB for the MP4 to keep initial load fast |
| **Content** | A montage of: facial treatment in progress, massage scene, hair styling, finished bridal look. Warm, premium colour grading. |

---

## 3.4 Complete Content Specification

All user-facing copy for implementation:

### 3.4.1 Banner A -- Facials

| Field | Copy |
|---|---|
| Heading | Premium Facials at Your Doorstep |
| Description | Expert facial treatments and cleanups delivered to your home in Jammu. Glow without the commute. |
| CTA | Book a Facial |

### 3.4.2 Banner B -- Bridal

| Field | Copy |
|---|---|
| Heading | Bridal Packages Tailored for You |
| Description | Complete bridal beauty prep -- from mehendi-ready hands to the perfect glow. Customised packages for your big day. |
| CTA | Explore Bridal |

### 3.4.3 Brand Story Section

| Field | Copy |
|---|---|
| Heading | The Glamornate Experience |
| Description | Glamornate brings the luxury salon experience to your doorstep in Jammu. From rejuvenating facials to complete bridal prep, our certified professionals deliver premium beauty services in the comfort of your home -- so you can look your best without stepping out. |
| CTA | Discover Our Story |

---

## 3.5 Responsive Behaviour Summary

| Element | Desktop (>=1024px) | Tablet (640-1023px) | Mobile (<640px) |
|---|---|---|---|
| Promo banners | 2-column grid, `gap-6` | 2-column grid, `gap-4` | Single column stack, `gap-4` |
| Banner card height | Min 280px | Min 260px | Min 220px |
| Banner image | Visible, right-aligned 45% width | Visible, right-aligned 40% width | Hidden or reduced to 30% width with increased opacity overlay for text readability |
| Brand heading | `text-5xl` | `text-4xl` | `text-3xl` |
| Brand description | `text-lg`, `max-w-[65ch]` | `text-base`, `max-w-[55ch]` | `text-base`, full container width |
| Brand video | `max-w-4xl`, `rounded-2xl` | `max-w-2xl`, `rounded-2xl` | Full width, `rounded-xl` |
| Decorative blobs | Visible | Visible (scaled down) | Hidden (`hidden md:block`) |

---

## 3.6 Accessibility Requirements

| Requirement | Implementation |
|---|---|
| Banner links | Each banner card is a single `<Link>` (or `<a>`) wrapping the entire card. `aria-label` includes the CTA context (e.g., `aria-label="Book a Facial -- Premium facials at your doorstep"`). |
| Colour contrast | All text on gradients must meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text). White text on `#880E4F` is 7.2:1 (passes AAA). Dark text on `#FFD700` backgrounds must use `brand-maroon-900` (#4A062A) for 8.1:1 ratio. |
| Video | `<video>` element has `aria-label="Glamornate services showcase video"`. Since video is muted and decorative, no captions required. If narration is added later, provide WebVTT captions via `<track>`. |
| Reduced motion | Banner hover transforms and video autoplay disabled when `prefers-reduced-motion: reduce`. Video shows poster image only. |
| Focus management | All interactive elements (banner links, CTA buttons) have visible focus rings via the `focus-ring` utility. Tab order follows visual order (Banner A -> Banner B -> Brand CTA). |
| Images | All images have descriptive `alt` text. Decorative blobs use `aria-hidden="true"`. |

---

## 3.7 Performance Considerations

| Concern | Mitigation |
|---|---|
| Banner images below fold | `loading="lazy"` and `fetchPriority="low"` on both banner images. Next.js `Image` with `placeholder="blur"` for perceived performance. |
| Video file size | Compress to under 8MB. Use `preload="metadata"` so the browser only fetches poster+headers until IntersectionObserver triggers play. |
| Video format | Provide both MP4 (H.264) and WebM (VP9) via `<source>` elements. Browsers select the most efficient format they support. |
| Gradient rendering | CSS gradients only (no image-based gradients). Zero additional network requests. |
| Decorative blobs | CSS-only (`border-radius: 50%` + background color). No SVG or image assets needed. |
| Cumulative Layout Shift | Banner cards have explicit `min-h-[280px] md:min-h-[280px]` to reserve space. Video container has `aspect-video` to prevent reflow on load. |

---

## 3.8 Component Breakdown (Suggested)

These are the suggested React component boundaries for implementation. Naming follows the project's existing conventions.

| Component | File Path | Responsibility |
|---|---|---|
| `PromoBanners` | `src/components/home/PromoBanners.tsx` | Section wrapper. Renders the 2-column grid and maps over banner data. |
| `PromoBannerCard` | `src/components/home/PromoBannerCard.tsx` | Single banner card. Accepts gradient, heading, description, CTA text, CTA link, image src, and blob color as props. |
| `BrandStory` | `src/components/home/BrandStory.tsx` | Full brand story section: wordmark heading, description, CTA, and video. |
| `BrandVideo` | `src/components/home/BrandVideo.tsx` | Video element with IntersectionObserver play/pause logic, poster, and responsive sizing. |

---

## 3.9 Asset Checklist

| Asset | Format | Dimensions | Notes |
|---|---|---|---|
| Facial treatment photo | WebP + JPEG fallback | 800x600px min | Warm tones, professional setting |
| Bridal preparation photo | WebP + JPEG fallback | 800x600px min | Soft/warm tones, hands or makeup focus |
| Brand video | MP4 (H.264) + WebM (VP9) | 1920x1080 source | 15-30s montage, under 8MB |
| Video poster image | WebP | 1920x1080 | Keyframe thumbnail from brand video |

---

## 3.10 Design Token Reference

All colours and utilities referenced in this section map to the existing Glamornate design system defined in `tailwind.config.ts` and `globals.css`:

| Token | Value | Usage in this section |
|---|---|---|
| `brand-maroon-500` | `#880E4F` | Banner A gradient base, wordmark "Glam", CTA button (Banner B) |
| `brand-maroon-600` | `#7B0C47` | Banner A gradient mid-stop, hover states |
| `brand-maroon-700` | `#6D0A3E` | Banner A gradient end |
| `brand-maroon-900` | `#4A062A` | Banner A gradient darkest, text on gold backgrounds |
| `brand-maroon-50` | `#FDF2F8` | Brand section background tint |
| `brand-gold-500` | `#FFD700` | Banner A CTA button, Banner B gradient start, wordmark "ornate" |
| `brand-gold-600` | `#EAB308` | Wordmark "ornate" alternative, hover states |
| `brand-gold-50` | `#FFFEF0` | Banner B gradient end, brand section background accent |
| `shadow-card-sm` | `0 1px 3px ...` | Banner default shadow |
| `shadow-card-hover` | `0 10px 15px ...` | Banner hover shadow |
| `shadow-card-lg` | `0 10px 15px ...` | Brand video shadow |
| `shadow-maroon` | `0 4px 14px ... rgba(136, 14, 79, 0.15)` | Banner B CTA shadow |
| `shadow-gold` | `0 4px 14px ... rgba(255, 215, 0, 0.2)` | Banner A CTA shadow |
| `btn-gradient` | Gold-to-maroon gradient button | Brand story CTA |
| `gradient-overlay-maroon` | Maroon at 10%/5% opacity | Brand section background |
| `section-padding` | `py-16 md:py-24` | Brand story section spacing |
