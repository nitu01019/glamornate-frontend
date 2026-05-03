# PRD Section 1: Hero Video Carousel + Global Navigation

**Product**: Glamornate -- Premium At-Home Spa Booking Platform
**Section Owner**: Product Design
**Last Updated**: 2026-04-10
**Status**: Draft
**Inspired By**: Yes Madam (yesmadam.com) hero/nav pattern, adapted for Glamornate brand and booking-first UX

---

## Table of Contents

1. [Section Overview](#1-section-overview)
2. [Video Carousel Specification](#2-video-carousel-specification)
3. [Overlay Content Specification](#3-overlay-content-specification)
4. [Navigation Bar Specification](#4-navigation-bar-specification)
5. [Carousel Indicators](#5-carousel-indicators)
6. [Responsive Behavior](#6-responsive-behavior)
7. [Performance Requirements](#7-performance-requirements)
8. [Accessibility Requirements](#8-accessibility-requirements)
9. [Design Tokens Reference](#9-design-tokens-reference)
10. [Open Questions](#10-open-questions)

---

## 1. Section Overview

### 1.1 Purpose

The Hero Video Carousel is the first visual element a user encounters on the Glamornate homepage. Its purpose is threefold:

1. **Establish premium brand perception** -- cinematic, full-viewport video communicates luxury and professionalism.
2. **Drive the primary conversion action** -- the "Book Your Service" CTA must be the most visually dominant interactive element on the page.
3. **Surface the partner recruitment funnel** -- a secondary CTA for spa professionals to register as Glamornate partners.

Unlike Yes Madam (which uses the hero to drive app downloads), Glamornate's hero must funnel users directly into the booking flow. The hero is not decorative -- it is the most important conversion surface on the site.

### 1.2 Viewport Behavior

| Property | Value |
|---|---|
| Height | `100vh` (full viewport height) on all devices |
| Width | `100vw` (full viewport width, no horizontal scroll) |
| Overflow | `hidden` on both axes |
| Position | `relative` (establishes stacking context for overlays) |
| Scroll snap | Optional: `scroll-snap-align: start` if parent uses scroll-snap |

The hero section occupies the entire initial viewport. No content below the fold is visible until the user scrolls. The navigation bar overlays the top of the hero.

### 1.3 Z-Index Layering

All z-index values are scoped within the hero stacking context:

| Layer | Z-Index | Content |
|---|---|---|
| Video background | `z-0` | `<video>` elements (one per carousel slide) |
| Gradient overlay | `z-10` | Dark gradient for text readability |
| Content overlay | `z-20` | Headline, CTAs, carousel dots |
| Mute toggle | `z-20` | Bottom-right audio control |
| Navigation bar | `z-50` | Global sticky nav (fixed position, outside hero stacking context) |
| Mobile menu drawer | `z-[60]` | Slide-out mobile menu (above nav) |
| Mobile menu backdrop | `z-[55]` | Semi-transparent overlay behind drawer |

---

## 2. Video Carousel Specification

### 2.1 Video Inventory

The carousel cycles through exactly three videos. Each video represents a core Glamornate service scenario:

| Slide | Content Description | Placeholder Reference | Duration |
|---|---|---|---|
| 1 | At-home facial treatment -- close-up of a professional aesthetician performing a luxury facial in a well-lit living room. Soft natural lighting, client relaxed on a portable treatment bed. | `/videos/hero/hero-facial.mp4` | 15-20s raw, 8s display |
| 2 | Massage therapy -- wide shot of a massage therapist working in a serene bedroom setting with candles and warm towels. Emphasis on professional setup brought into the home. | `/videos/hero/hero-massage.mp4` | 15-20s raw, 8s display |
| 3 | Bridal preparation -- a bridal makeup and hair session in progress. Multiple professionals working together. Joyful, celebratory atmosphere. | `/videos/hero/hero-bridal.mp4` | 15-20s raw, 8s display |

**Video production notes for content team:**
- All videos must be shot in 16:9 aspect ratio at minimum 1080p (1920x1080).
- 4K source files preferred for future-proofing; delivery in 1080p and 720p encoded variants.
- Color grade must align with Glamornate brand warmth -- warm midtones, deep shadows, gold highlights.
- No visible branding, watermarks, or text baked into the video files (all text is rendered as HTML overlay).
- Talent must be diverse and representative of Glamornate's target demographic.

### 2.2 Auto-Play and Timing

| Property | Value | Notes |
|---|---|---|
| Auto-play | `true` | Begins on page load (first video only -- see preload strategy) |
| Display duration per slide | **8 seconds** | Carousel advances automatically after 8s regardless of video loop point |
| Loop behavior | Each video loops individually | If a video is shorter than 8s, it loops seamlessly; if longer, it is cut at 8s by the carousel transition |
| Pause on interaction | No | Carousel does not pause when user hovers or focuses within the hero |
| Pause on visibility | Yes | Pause all video playback when the hero is scrolled out of viewport (IntersectionObserver) |
| Resume on visibility | Yes | Resume the current video when hero scrolls back into view |
| Direction | Forward only | Slides advance 1 -> 2 -> 3 -> 1 -> ... (no reverse) |
| User manual navigation | Via carousel dots | Clicking a dot jumps to that slide and resets the 8s timer |

### 2.3 Transition Type

**Crossfade transition** (not slide/swipe):

| Property | Value |
|---|---|
| Transition type | Opacity crossfade |
| Transition duration | `1200ms` (1.2 seconds) |
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out) |
| Implementation | Two `<video>` elements stacked absolutely; outgoing fades from `opacity: 1` to `opacity: 0`, incoming fades from `opacity: 0` to `opacity: 1` simultaneously |
| During transition | Both videos play simultaneously for the 1.2s overlap period |

Rationale: Crossfade is more cinematic than a horizontal slide and matches the premium brand tone. A slide transition feels app-like; crossfade feels editorial.

### 2.4 Mute / Unmute Toggle

Videos are **muted by default**. A toggle button allows the user to unmute.

| Property | Value |
|---|---|
| Default state | Muted (`muted` attribute on all `<video>` elements) |
| Position | Bottom-right corner of the hero, `16px` from right edge, `16px` above carousel dots |
| Size | `44px x 44px` (meets WCAG touch target minimum) |
| Icon | Muted: speaker-with-X icon. Unmuted: speaker-with-waves icon. |
| Background | `rgba(0, 0, 0, 0.4)` with `backdrop-filter: blur(8px)` |
| Border | `1px solid rgba(255, 255, 255, 0.15)` |
| Border radius | `50%` (circular) |
| Icon color | `#FFFFFF` at 90% opacity |
| Hover state | Background lightens to `rgba(255, 255, 255, 0.2)` |
| Active/pressed | Scale to `0.92` for `100ms`, then back to `1` |
| State persistence | Mute state persists within the session (no localStorage -- resets on page reload) |
| Scope | Toggle applies to ALL carousel videos simultaneously |

### 2.5 Mobile Video Behavior

Mobile devices have significant constraints around autoplay video (battery, bandwidth, data caps). The mobile strategy differs from desktop:

| Condition | Behavior |
|---|---|
| **Mobile + fast connection** (3G+ / WiFi) | Autoplay muted video, same as desktop. Use 720p encoded variant. |
| **Mobile + slow connection** (detected via `navigator.connection.effectiveType === '2g'` or `'slow-2g'`) | Do NOT load video. Display a high-quality **poster image** instead. Poster uses the same gradient overlay and all text/CTA content. |
| **Mobile + `prefers-reduced-motion: reduce`** | Display poster image. No video playback. No carousel animation (static first slide). |
| **Mobile + `Save-Data: on`** header | Display poster image. No video. |
| **iOS Safari** | All videos must include `playsinline` attribute. Without it, iOS will attempt fullscreen playback. |

**Poster images** (one per video/slide):

| Slide | Poster Reference | Format |
|---|---|---|
| 1 | `/images/hero/hero-facial-poster.webp` | WebP with JPEG fallback |
| 2 | `/images/hero/hero-massage-poster.webp` | WebP with JPEG fallback |
| 3 | `/images/hero/hero-bridal-poster.webp` | WebP with JPEG fallback |

Poster images must be extracted from the video files at the most visually compelling frame and optimized to under 150KB each at 1280x720.

### 2.6 Video Sizing and Cropping

| Property | Value |
|---|---|
| Object fit | `object-fit: cover` (fills the container, crops overflow) |
| Object position | `object-position: center center` (default) |
| Per-video override | Allow per-video `object-position` via data attribute for art direction (e.g., bridal video may need `center 30%` to keep faces in frame on mobile) |

---

## 3. Overlay Content Specification

### 3.1 Gradient Overlay

A gradient overlay sits between the video and the text content to ensure readability regardless of video frame brightness:

| Property | Value |
|---|---|
| Type | Linear gradient, multiple stops |
| Direction | `to bottom` |
| Stops | `rgba(0, 0, 0, 0.55) 0%`, `rgba(0, 0, 0, 0.25) 40%`, `rgba(0, 0, 0, 0.35) 70%`, `rgba(0, 0, 0, 0.65) 100%` |
| Additional | A secondary radial gradient from center: `radial-gradient(ellipse at 50% 60%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 100%)` composited on top for vignette effect |
| Coverage | Full width and height of hero |
| Position | `absolute`, `inset: 0` |

Rationale: The multi-stop gradient is darker at top (where nav text lives) and bottom (where CTAs and dots live), lighter in the center where the video visual impact matters most. The vignette draws the eye to center content.

### 3.2 Headline Text

The headline communicates Glamornate's core value proposition. It must be scannable in under 3 seconds.

**Headline options (choose one during design review):**

**Option A (Recommended):**
> Luxury Spa Experiences, **Delivered to Your Doorstep**

Accent phrase: "Delivered to Your Doorstep" in Gold (#FFD700).

**Option B:**
> Premium Beauty & Wellness, **Right Where You Are**

Accent phrase: "Right Where You Are" in Gold (#FFD700).

**Option C:**
> Bringing Salon **Excellence** to the Comfort of **Your Home**

Accent words: "Excellence" and "Your Home" in Gold (#FFD700).

### 3.3 Headline Typography

| Property | Desktop (>=1024px) | Tablet (768-1023px) | Mobile (<768px) |
|---|---|---|---|
| Font family | `var(--font-serif)` (brand serif) | Same | Same |
| Font size | `56px` / `3.5rem` | `42px` / `2.625rem` | `32px` / `2rem` |
| Line height | `1.15` | `1.2` | `1.25` |
| Font weight | `600` (semibold) | `600` | `600` |
| Color | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| Accent color | `#FFD700` (brand gold) | Same | Same |
| Letter spacing | `-0.02em` | `-0.01em` | `0` |
| Max width | `720px` (prevent overly long lines) | `560px` | `100%` (full width with padding) |
| Text shadow | `0 2px 12px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3)` | Same | Same |
| Text alignment | `center` | `center` | `center` |

### 3.4 Subheadline (Optional)

A single-line subheadline beneath the main headline provides supporting context:

> Book top-rated professionals for facials, massages, bridal prep, and more.

| Property | Desktop | Tablet | Mobile |
|---|---|---|---|
| Font family | `var(--font-sans)` | Same | Same |
| Font size | `18px` / `1.125rem` | `16px` / `1rem` | `15px` / `0.9375rem` |
| Font weight | `400` (regular) | `400` | `400` |
| Color | `rgba(255, 255, 255, 0.85)` | Same | Same |
| Text shadow | `0 1px 6px rgba(0, 0, 0, 0.4)` | Same | Same |
| Margin top | `16px` from headline | `12px` | `12px` |
| Max width | `560px` | `480px` | `100%` |
| Text alignment | `center` | `center` | `center` |

### 3.5 CTA Buttons

Two CTA buttons sit below the headline/subheadline, centered horizontally.

#### Primary CTA: "Book Your Service"

| Property | Desktop | Mobile |
|---|---|---|
| Label | "Book Your Service" | "Book Your Service" |
| Background | `#880E4F` (brand maroon 500) | Same |
| Background hover | `#7B0C47` (brand maroon 600) | Same |
| Text color | `#FFFFFF` | Same |
| Font size | `16px` / `1rem` | `15px` / `0.9375rem` |
| Font weight | `600` | `600` |
| Padding | `16px 40px` | `14px 32px` |
| Border radius | `9999px` (pill) | Same |
| Min width | `220px` | `100%` (full width on mobile) |
| Box shadow | `0 4px 20px rgba(136, 14, 79, 0.4)` | Same |
| Box shadow hover | `0 6px 28px rgba(136, 14, 79, 0.55)` | Same |
| Transition | `all 200ms cubic-bezier(0.4, 0, 0.2, 1)` | Same |
| Hover transform | `translateY(-1px)` | N/A (no hover on touch) |
| Active transform | `translateY(0) scale(0.98)` | Same |
| Link target | `/services` (services catalog page) | Same |

#### Secondary CTA: "Register as Partner"

| Property | Desktop | Mobile |
|---|---|---|
| Label | "Register as Partner" | "Register as Partner" |
| Background | `transparent` | Same |
| Border | `2px solid #FFD700` (brand gold) | Same |
| Border hover | `2px solid #FFD700` | Same |
| Background hover | `rgba(255, 215, 0, 0.12)` | Same |
| Text color | `#FFD700` | Same |
| Text color hover | `#FFFFFF` | Same |
| Font size | `16px` / `1rem` | `15px` / `0.9375rem` |
| Font weight | `500` | `500` |
| Padding | `16px 40px` | `14px 32px` |
| Border radius | `9999px` (pill) | Same |
| Min width | `220px` | `100%` (full width on mobile) |
| Transition | `all 200ms cubic-bezier(0.4, 0, 0.2, 1)` | Same |
| Hover transform | `translateY(-1px)` | N/A |
| Active transform | `translateY(0) scale(0.98)` | Same |
| Link target | `/partner/register` (partner registration page) | Same |

#### CTA Layout

| Property | Desktop | Mobile |
|---|---|---|
| Direction | Horizontal (`flex-row`) | Vertical (`flex-col`) |
| Gap | `16px` between buttons | `12px` between buttons |
| Margin top | `32px` from subheadline | `24px` |
| Alignment | `center` (both axes) | `center`, full-width buttons |
| Container padding | `0 24px` | `0 24px` |

### 3.6 Content Vertical Positioning

All overlay content (headline, subheadline, CTAs) is vertically centered within the hero viewport with a slight upward offset to account for the visual weight of the navigation at the top and dots at the bottom:

| Property | Value |
|---|---|
| Container | `absolute`, `inset: 0`, `display: flex`, `flex-direction: column`, `align-items: center`, `justify-content: center` |
| Vertical offset | `padding-top: 80px` (accounts for nav height) and `padding-bottom: 60px` (accounts for dots + mute toggle) |
| Text container padding | `0 24px` (prevents edge-to-edge text on any screen) |

---

## 4. Navigation Bar Specification

### 4.1 Overview

The global navigation bar is a fixed-position element that persists across all pages. On the homepage, it overlays the hero video with a transparent background that transitions to an opaque white background on scroll.

### 4.2 Dimensions and Position

| Property | Value |
|---|---|
| Position | `fixed`, `top: 0`, `left: 0`, `right: 0` |
| Height (desktop) | `80px` |
| Height (mobile) | `64px` |
| Z-index | `z-50` |
| Inner layout | `max-width: 1400px`, centered with `margin: 0 auto`, `padding: 0 24px` |
| Content alignment | `display: flex`, `align-items: center`, `justify-content: space-between` |

### 4.3 Transparent-to-Solid Scroll Transition

The nav has two visual states based on scroll position.

**State 1: Transparent (scroll position < 80px)**

| Property | Value |
|---|---|
| Background | `transparent` |
| Border bottom | `none` |
| Logo text color | `#FFFFFF` |
| Nav link color | `rgba(255, 255, 255, 0.85)` |
| Nav link hover | `#FFFFFF` |
| "Book Now" button | Solid maroon (`#880E4F`) bg, white text |
| Box shadow | `none` |

**State 2: Solid (scroll position >= 80px)**

| Property | Value |
|---|---|
| Background | `rgba(255, 255, 255, 0.95)` with `backdrop-filter: blur(12px)` and `-webkit-backdrop-filter: blur(12px)` |
| Border bottom | `1px solid rgba(0, 0, 0, 0.06)` |
| Logo text color | Gradient text (brand maroon to gold, existing `gradient-text-premium` class) |
| Nav link color | `#4B5563` (gray-600) |
| Nav link hover | `#880E4F` (brand maroon) |
| Active link color | `#880E4F` (brand maroon) |
| "Book Now" button | Same solid maroon |
| Box shadow | `0 1px 3px rgba(0, 0, 0, 0.06)` |

**Transition:**

| Property | Value |
|---|---|
| Transition property | `background-color, border-color, box-shadow, color` |
| Duration | `300ms` |
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Scroll threshold | `80px` from top |
| Implementation | `scroll` event listener (throttled via `requestAnimationFrame`) or `IntersectionObserver` on a sentinel element placed at `80px` from top |

### 4.4 Logo

| Property | Value |
|---|---|
| Position | Left-aligned |
| Elements | Icon (Sparkles icon in gradient square) + "Glamornate" wordmark |
| Icon container | `36px x 36px`, `border-radius: 12px`, gradient from `brand-gold-400` to `brand-maroon-500` |
| Icon | Sparkles, `20px x 20px`, `#FFFFFF` |
| Wordmark font | `var(--font-serif)`, `20px`, `font-weight: 600` |
| Wordmark color (transparent) | `#FFFFFF` |
| Wordmark color (solid) | Gradient text (existing `gradient-text-premium` utility) |
| Hover effect | Icon shadow intensifies: `shadow-brand-maroon-500/20` to `shadow-brand-maroon-500/40` |
| Link target | `/` (homepage) |

### 4.5 Desktop Navigation Links

Visible at `>=768px` (`md` breakpoint).

| Link | Href | Notes |
|---|---|---|
| Home | `/` | Active when `pathname === '/'` |
| Services | `/services` | Active when `pathname.startsWith('/services')` |
| About | `/about` | Active when `pathname === '/about'` |
| Blog | `/blog` | Active when `pathname.startsWith('/blog')` |
| Contact | `/contact` | Active when `pathname === '/contact'` |

**Link styling:**

| Property | Value |
|---|---|
| Font | `var(--font-sans)`, `14px`, `font-weight: 500` |
| Letter spacing | `0.01em` |
| Gap between links | `32px` |
| Active indicator | `2px` solid underline, `#880E4F` (solid nav) or `#FFFFFF` (transparent nav), offset `4px` below text via `border-bottom` or pseudo-element |
| Active indicator transition | `width` from `0` to `100%` over `200ms` (expand from center) |
| Hover effect | Color transition `150ms`, underline appears on hover as well (same style as active but `opacity: 0.5`) |

### 4.6 "Book Now" Pill Button

Positioned at the far right of the nav, before any authenticated user menu.

| Property | Desktop | Mobile |
|---|---|---|
| Label | "Book Now" | Hidden (action available in mobile menu) |
| Background | `#880E4F` (brand maroon 500) | N/A |
| Background hover | `#7B0C47` (brand maroon 600) | N/A |
| Text color | `#FFFFFF` | N/A |
| Font | `14px`, `font-weight: 600` | N/A |
| Padding | `10px 24px` | N/A |
| Border radius | `9999px` (pill) | N/A |
| Box shadow | `0 2px 8px rgba(136, 14, 79, 0.25)` | N/A |
| Box shadow hover | `0 4px 16px rgba(136, 14, 79, 0.35)` | N/A |
| Hover transform | `translateY(-1px)` | N/A |
| Link target | `/services` | N/A |
| Visibility | `hidden` below `md` breakpoint | N/A |

### 4.7 Authenticated User State

When a user is logged in, the right side of the nav shows a user avatar dropdown instead of "Sign In" and "Book Now" buttons. This behavior already exists in the current Header component and should be preserved exactly as-is. The avatar dropdown is role-aware (customer, spa_owner, admin) and displays role-appropriate menu items.

The "Book Now" button remains visible alongside the user dropdown for authenticated users who are customers.

### 4.8 Mobile Hamburger Menu

Visible at `<768px` (`md` breakpoint).

**Hamburger button:**

| Property | Value |
|---|---|
| Position | Right-aligned |
| Size | `44px x 44px` touch target |
| Icon (closed) | Three-line hamburger (`Menu` from lucide-react), `24px` |
| Icon (open) | X mark (`X` from lucide-react), `24px` |
| Color (transparent nav) | `#FFFFFF` |
| Color (solid nav) | `#374151` (gray-700) |
| Hover background (transparent) | `rgba(255, 255, 255, 0.1)` |
| Hover background (solid) | `#F3F4F6` (gray-100) |
| Border radius | `8px` |
| Animation | Icon morphs from hamburger to X with `150ms` crossfade |

**Mobile menu drawer:**

| Property | Value |
|---|---|
| Position | `fixed`, `top: 0`, `right: 0`, `height: 100vh` |
| Width | `320px`, `max-width: 85vw` |
| Background | `#FFFFFF` |
| Z-index | `z-[60]` |
| Entry animation | `translateX(100%)` to `translateX(0)`, `300ms`, `ease-out` |
| Exit animation | `translateX(0)` to `translateX(100%)`, `250ms`, `ease-in` |
| Backdrop | `fixed`, `inset: 0`, `rgba(0, 0, 0, 0.5)`, closes menu on click |
| Backdrop z-index | `z-[55]` |
| Body scroll lock | `overflow: hidden` on `<body>` when menu is open |

**Mobile menu content (top to bottom):**

1. **Header row**: Logo + close button (X icon), `padding: 16px`, `border-bottom`
2. **User info card** (if authenticated): Avatar, name, email, role badge. Background `brand-maroon-50`.
3. **Navigation links**: Home, Services, About, Blog, Contact. Each link is `48px` tall, full-width, with icon (optional) and label. Active link has `bg-brand-maroon-50` and `text-brand-maroon-600`.
4. **"Book Now" button**: Full-width, `btn-gradient` style, `margin: 16px`.
5. **Account section** (if authenticated): Profile, My Bookings, Settings links. Separated by labeled divider "Account".
6. **Footer actions**: "Sign In" / "Get Started" buttons (if unauthenticated), or "Sign Out" button (if authenticated). Pinned to bottom with `border-top`.

**Mobile menu closes on:**
- Tap on backdrop overlay
- Tap on close (X) button
- Tap on any navigation link (route change)
- Press `Escape` key
- Swipe right gesture (stretch goal -- not MVP)

---

## 5. Carousel Indicators

### 5.1 Dot Indicators

Horizontal dot indicators show which video is currently playing.

| Property | Value |
|---|---|
| Position | Bottom center of hero, `24px` from bottom edge |
| Layout | Horizontal `flex`, `gap: 12px`, centered |
| Number of dots | 3 (matches number of videos) |
| Z-index | `z-20` (above gradient overlay, below nav) |

### 5.2 Dot States

**Inactive dot:**

| Property | Value |
|---|---|
| Size | `8px x 8px` |
| Shape | Circle (`border-radius: 50%`) |
| Background | `rgba(255, 255, 255, 0.4)` |
| Border | `none` |
| Cursor | `pointer` |
| Hover background | `rgba(255, 255, 255, 0.6)` |
| Transition | `background-color 200ms, width 400ms, border-radius 400ms` |

**Active dot:**

| Property | Value |
|---|---|
| Size | `32px x 8px` (elongated pill) |
| Shape | Pill (`border-radius: 4px`) |
| Background | `#FFD700` (brand gold) |
| Border | `none` |
| Transition | Animates from `8px` circle to `32px` pill over `400ms` with `ease-out` |

The active dot expanding into a pill shape provides a clear, high-contrast indicator of the current slide without requiring color vision (the shape change carries the information).

### 5.3 Dot Interaction

| Action | Behavior |
|---|---|
| Click/tap on inactive dot | Jump to that video slide immediately. Crossfade transition plays. The 8s auto-advance timer resets. |
| Click/tap on active dot | No action. |
| Keyboard focus | Dots are focusable via Tab. `Enter` or `Space` activates. Focus ring: `2px solid #FFD700`, `offset: 2px`. |

### 5.4 Progress Indicator (Enhancement -- Post-MVP)

For a future iteration, consider adding a progress bar within the active dot that fills from left to right over the 8s display duration, giving users a visual cue of when the next slide will appear. This is not required for the initial implementation.

---

## 6. Responsive Behavior

### 6.1 Breakpoints

Glamornate uses the standard Tailwind breakpoints already configured in the project:

| Breakpoint | Min Width | Label |
|---|---|---|
| Mobile | `0px` | Default |
| `sm` | `640px` | Small |
| `md` | `768px` | Medium (tablet portrait) |
| `lg` | `1024px` | Large (tablet landscape / small desktop) |
| `xl` | `1280px` | Extra large (desktop) |
| `2xl` | `1400px` | Max content width |

### 6.2 Mobile Layout (< 768px)

| Element | Behavior |
|---|---|
| **Hero height** | `100vh` (unchanged) |
| **Video** | Plays if connection permits; poster fallback otherwise (see section 2.5). Uses 720p variant. |
| **Headline** | `32px` / `2rem`, centered, full width minus `48px` total padding |
| **Subheadline** | `15px`, centered |
| **CTAs** | Stacked vertically (`flex-col`). Both buttons are full-width (`width: 100%`). Primary on top, secondary below. Gap `12px`. |
| **Navigation** | Hamburger menu. Logo + hamburger icon visible. |
| **Carousel dots** | Same position and size. Touch target extended to `44px x 44px` via transparent padding. |
| **Mute toggle** | Same position. `44px x 44px` (already meets touch minimum). |
| **Gradient overlay** | Same, but bottom gradient stop is slightly more opaque (`0.7` instead of `0.65`) to improve CTA readability over variable video content. |

### 6.3 Tablet Layout (768px - 1023px)

| Element | Behavior |
|---|---|
| **Hero height** | `100vh` |
| **Video** | Same as desktop. Uses 1080p variant. |
| **Headline** | `42px` / `2.625rem`, centered, max-width `560px` |
| **Subheadline** | `16px`, centered, max-width `480px` |
| **CTAs** | Horizontal layout (`flex-row`), centered. Both buttons have `min-width: 200px`. |
| **Navigation** | Full desktop nav visible. Links may use slightly tighter gap (`24px` instead of `32px`). |
| **Carousel dots** | Same as desktop. |
| **Mute toggle** | Same as desktop. |

### 6.4 Desktop Layout (>= 1024px)

| Element | Behavior |
|---|---|
| **Hero height** | `100vh` |
| **Video** | 1080p variant. Preloads first video. |
| **Headline** | `56px` / `3.5rem`, centered, max-width `720px` |
| **Subheadline** | `18px`, centered, max-width `560px` |
| **CTAs** | Horizontal layout, centered. `min-width: 220px` per button. |
| **Navigation** | Full nav with all links, "Book Now" pill, user menu. |
| **Carousel dots** | `24px` from bottom. |
| **Mute toggle** | `16px` from right, `16px` above dots. |

### 6.5 Ultra-Wide (>= 2560px)

| Element | Behavior |
|---|---|
| **Video** | `object-fit: cover` ensures no letterboxing. May load 4K variant in the future. |
| **Content** | All text and CTAs remain constrained to `max-width: 720px` to prevent uncomfortable reading widths. |
| **Nav** | Inner content maxes at `1400px` (existing container config). |

---

## 7. Performance Requirements

### 7.1 Video Preload Strategy

Loading three HD videos simultaneously on page load would be catastrophic for performance. The preload strategy is tiered:

| Video | Preload Behavior |
|---|---|
| **Video 1** (facial) | `preload="auto"`. Begin loading immediately on page mount. This is the first video the user sees. |
| **Video 2** (massage) | `preload="none"`. Begin loading when Video 1 starts playing (after user interaction or autoplay engages). Use `fetch()` or dynamically set `src` to trigger load. |
| **Video 3** (bridal) | `preload="none"`. Begin loading when Video 2 starts playing. |

The key invariant: **Only one video should be actively downloading at any time.** Network waterfall, not parallel download.

### 7.2 Video Encoding Recommendations

| Variant | Resolution | Codec | Target Bitrate | Max File Size | Use Case |
|---|---|---|---|---|---|
| Desktop HD | 1920x1080 | H.264 (MP4) | 4-6 Mbps | ~8MB per 10s | Desktop, fast connections |
| Mobile | 1280x720 | H.264 (MP4) | 2-3 Mbps | ~4MB per 10s | Mobile, normal connections |
| WebM (optional) | 1920x1080 | VP9 | 3-4 Mbps | ~5MB per 10s | Browsers with VP9 support (smaller files) |

Use `<source>` elements within `<video>` to provide format options:

```
<video>
  <source src="hero-facial-1080.webm" type="video/webm">
  <source src="hero-facial-1080.mp4" type="video/mp4">
</video>
```

### 7.3 Poster Image Optimization

| Property | Value |
|---|---|
| Format | WebP primary, JPEG fallback |
| Resolution | 1280x720 |
| Max file size | 150KB per poster |
| Quality | 80-85% (WebP), 85% (JPEG) |
| Loading | First poster: eager (`loading="eager"`). Others: lazy. |

### 7.4 Largest Contentful Paint (LCP) Considerations

The hero is very likely the LCP element. Optimize accordingly:

| Concern | Mitigation |
|---|---|
| Video as LCP | The poster image of Video 1 should be set as the `poster` attribute on the `<video>` element. The browser paints the poster immediately while the video loads. |
| Font loading | Ensure the serif font (used in headline) is preloaded via `<link rel="preload" as="font">` in the document head. |
| CLS (Cumulative Layout Shift) | The hero is `100vh` and fixed -- no layout shift expected. Ensure no content reflow when video loads. |
| FID/INP | CTAs must be interactive within 100ms of page load. No heavy JS should block the main thread during hero render. |

### 7.5 playsinline Attribute

All `<video>` elements must include these attributes:

```
autoplay
muted
playsinline
loop
```

The `playsinline` attribute is critical for iOS Safari, which otherwise forces fullscreen video playback. The `muted` attribute is required for autoplay to work in all modern browsers (Chrome, Firefox, Safari all block autoplay with sound).

### 7.6 Reduced Motion Preference

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all carousel transitions */
  /* Show static first poster image */
  /* Disable the crossfade animation */
  /* Dots remain static (no pill expansion animation) */
  /* Mute toggle still functions */
  /* Nav scroll transition remains (it is not a repeating animation) */
}
```

When reduced motion is preferred:
- No video playback. Display poster image of Slide 1 only.
- No carousel auto-advance.
- Dot interaction still works (instant switch, no crossfade).
- All button hover/active transforms are disabled.
- Nav background transitions still apply (functional, not decorative).

---

## 8. Accessibility Requirements

### 8.1 Skip-to-Content Link

A visually hidden skip link must be the first focusable element in the DOM:

| Property | Value |
|---|---|
| Label | "Skip to main content" |
| Target | `#main-content` (an `id` placed on the `<main>` element after the hero) |
| Position | Hidden by default (`sr-only`). Becomes visible on `:focus` at top of viewport. |
| Visible style | `position: fixed`, `top: 8px`, `left: 8px`, `z-index: 100`, `background: #880E4F`, `color: #FFFFFF`, `padding: 12px 24px`, `border-radius: 8px`, `font-size: 14px`, `font-weight: 600` |
| Focus ring | `2px solid #FFD700`, `offset: 2px` |

### 8.2 Video Accessibility

| Requirement | Implementation |
|---|---|
| **Captions** | Each video should have a corresponding WebVTT caption track (`<track kind="captions">`). Captions describe the scene for users who cannot see the video. Not dialogue captions -- descriptive captions (e.g., "[A professional aesthetician performs a luxury facial in a sunlit living room]"). |
| **Audio description** | If videos contain meaningful audio (narration, dialogue), provide an audio description track. If videos are ambient/music-only, this is not required. |
| **ARIA role** | The carousel container should have `role="region"` and `aria-label="Hero video carousel"`. |
| **ARIA live** | Slide changes should announce via `aria-live="polite"`: "Slide 2 of 3: Massage therapy" (using a visually hidden live region). |
| **Pause mechanism** | The mute/unmute toggle and the ability to click dots (which effectively pauses auto-advance to that slide) satisfy WCAG 2.2.2 (Pause, Stop, Hide). However, consider adding an explicit pause button for the carousel auto-advance if QA identifies confusion. |

### 8.3 Mute Toggle Accessibility

| Property | Value |
|---|---|
| Element | `<button>` |
| `aria-label` (muted state) | "Unmute video" |
| `aria-label` (unmuted state) | "Mute video" |
| `aria-pressed` | `true` when unmuted, `false` when muted |
| Focus ring | `2px solid #FFD700`, `offset: 2px` |
| Keyboard | `Enter` or `Space` toggles mute state |

### 8.4 Carousel Keyboard Navigation

| Key | Action |
|---|---|
| `Tab` | Moves focus through interactive elements: skip link -> nav links -> nav buttons -> carousel dots -> mute toggle -> CTAs. Standard tab order. |
| `Arrow Left` / `Arrow Right` | When focus is on a carousel dot, moves to previous/next dot and activates that slide. |
| `Enter` / `Space` | When focus is on a carousel dot, activates that slide (same as click). |
| `Escape` | If mobile menu is open, closes it. No effect on carousel. |

### 8.5 Dot Indicator Accessibility

| Property | Value |
|---|---|
| Container element | `<div role="tablist" aria-label="Video carousel slides">` |
| Each dot element | `<button role="tab">` |
| Active dot | `aria-selected="true"`, `tabindex="0"` |
| Inactive dots | `aria-selected="false"`, `tabindex="-1"` |
| Dot labels | `aria-label="Slide 1: Facial treatment"`, `aria-label="Slide 2: Massage therapy"`, `aria-label="Slide 3: Bridal preparation"` |

### 8.6 Navigation Accessibility

| Requirement | Implementation |
|---|---|
| Landmark | `<header>` element wraps the entire nav. `<nav aria-label="Main navigation">` wraps the link list. |
| Current page | Active link has `aria-current="page"`. |
| Mobile menu button | `aria-expanded="true/false"`, `aria-controls="mobile-menu"`, `aria-label="Open menu" / "Close menu"`. |
| Mobile menu | `id="mobile-menu"`, `role="dialog"`, `aria-modal="true"`, `aria-label="Navigation menu"`. |
| Focus trap | When mobile menu is open, focus is trapped within the menu. Tab cycles through menu items. Focus returns to hamburger button on close. |
| Dropdown menus | User dropdown uses `aria-expanded`, `aria-haspopup="true"`, and focus management. |

### 8.7 Color Contrast

| Text | Background | Contrast Ratio | WCAG Level |
|---|---|---|---|
| White headline on dark gradient | `rgba(0,0,0,0.55)` minimum | >= 7:1 | AAA |
| Gold accent text on dark gradient | `#FFD700` on `rgba(0,0,0,0.55)` | >= 4.5:1 | AA (large text) |
| White nav links on transparent | Video varies -- gradient overlay ensures minimum | >= 4.5:1 | AA |
| Gray nav links on white solid bg | `#4B5563` on `#FFFFFF` | 7.45:1 | AAA |
| White text on maroon button | `#FFFFFF` on `#880E4F` | 7.2:1 | AAA |
| Gold text on dark hero | `#FFD700` on `rgba(0,0,0,0.55)` | >= 4.5:1 | AA (large text) |

---

## 9. Design Tokens Reference

These tokens map to the existing Glamornate design system defined in `tailwind.config.ts` and `globals.css`:

| Token | Value | Tailwind Class |
|---|---|---|
| Brand Maroon 500 | `#880E4F` | `bg-brand-maroon-500`, `text-brand-maroon-500` |
| Brand Maroon 600 | `#7B0C47` | `bg-brand-maroon-600` |
| Brand Gold 500 | `#FFD700` | `text-brand-gold-500` |
| Brand Gold 400 | `#FDE047` | `bg-brand-gold-400` |
| Font Serif | `var(--font-serif)` | `font-serif` |
| Font Sans | `var(--font-sans)` | `font-sans` |
| Pill radius | `9999px` | `rounded-pill` |
| Shadow Maroon | `0 4px 14px rgba(136,14,79,0.15)` | `shadow-maroon` |
| Shadow Maroon LG | `0 10px 40px rgba(136,14,79,0.3)` | `shadow-maroon-lg` |
| Gradient Premium | `linear-gradient(135deg, #FFD700, #880E4F)` | `--gradient-premium` |

---

## 10. Open Questions

| ID | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | Do we have video assets ready, or do we need to commission them? If commissioning, what is the timeline? Should we launch with poster images only and add video in a subsequent release? | Content/Marketing | Open |
| OQ-2 | Should the carousel auto-advance pause when the browser tab is not active (Page Visibility API)? Recommended: yes. | Engineering | Open |
| OQ-3 | Should we A/B test the three headline options, or decide in design review? | Product | Open |
| OQ-4 | Is the "Register as Partner" CTA validated as a conversion driver for the hero? Or should the secondary CTA be something else (e.g., "Explore Services", "View Pricing")? | Product/Growth | Open |
| OQ-5 | Should the nav include a location/city selector (similar to Yes Madam's city picker) for Glamornate's future multi-city expansion? If yes, that changes the nav layout significantly. | Product | Open |
| OQ-6 | Do we want a scroll-down affordance (e.g., a bouncing chevron or "Scroll to explore" text) at the very bottom of the hero to hint that there is content below the fold? | Design | Open |
| OQ-7 | For the existing Header component (`src/components/layout/Header.tsx`), should we refactor it to support the new hero-specific transparent behavior, or create a new `HeroNav` component that extends it? | Engineering | Open |
