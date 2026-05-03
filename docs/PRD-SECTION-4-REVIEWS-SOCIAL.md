# PRD Section 4 -- Customer Reviews, Social Proof & Trust Badges

**Product:** Glamornate Website Redesign
**Section:** 4 of N
**Inspired by:** Yes Madam homepage (media coverage, celebrity carousel, customer reviews)
**Last updated:** 2026-04-10

---

## 4.0 Overview

This section defines two homepage blocks that sit below the service listings and above the footer CTA:

1. **Trust Badges** -- a static row of four trust indicators replacing the media-coverage grid (Glamornate does not yet have press mentions).
2. **Customer Reviews** -- a split-layout panel with an aggregate rating on the left and a horizontally-scrolling carousel of review cards on the right.

Together they serve one goal: convert a browsing visitor into a booking customer by surfacing credibility signals at the moment of highest intent.

---

## 4.1 Trust Badges Section

### 4.1.1 Purpose

Replace Yes Madam's media-coverage grid with locally-relevant trust signals. The section answers the visitor's implicit question: "Can I trust this brand?"

### 4.1.2 Section Header

| Property | Value |
|---|---|
| Heading text | "Why Customers Trust Glamornate" |
| Subheading text | "Trusted by 500+ customers in Jammu" |
| Heading tag | `<h2>` |
| Heading font | `text-2xl md:text-3xl font-bold text-brand-maroon-800` |
| Subheading font | `text-base md:text-lg text-muted-foreground` |
| Alignment | Center |
| Top padding | `py-12 md:py-16` |
| Background | `bg-brand-maroon-50` (light rose tint, #FDF2F8) |

### 4.1.3 Badge Grid Layout

| Breakpoint | Columns | Gap |
|---|---|---|
| Mobile (< 640px) | 2 columns | `gap-4` |
| Tablet (640-1023px) | 4 columns | `gap-6` |
| Desktop (>= 1024px) | 4 columns | `gap-8` |

Container: `max-w-5xl mx-auto px-4`

### 4.1.4 Individual Badge Spec

Each badge is a flex-column card, center-aligned.

| Element | Spec |
|---|---|
| Container | `flex flex-col items-center text-center p-6 rounded-card bg-white` |
| Shadow | `shadow-card-sm`, on hover `shadow-card-md` |
| Hover transform | `hover:-translate-y-1 transition-all duration-300` |
| Icon wrapper | `w-14 h-14 rounded-full bg-brand-maroon-50 flex items-center justify-center mb-3` |
| Icon style | Outline/line-art style, `stroke-brand-maroon-500`, 28px (stroke-width 1.5) |
| Label | `text-sm md:text-base font-semibold text-brand-maroon-800` |
| Subtitle | `text-xs md:text-sm text-muted-foreground mt-1` |

### 4.1.5 Badge Content

| # | Icon (Lucide name) | Label | Subtitle |
|---|---|---|---|
| 1 | `ShieldCheck` | Verified Professionals | Background-checked & trained |
| 2 | `Sparkles` | Hygienic Products | Sealed packs, premium brands |
| 3 | `Clock` | On-Time Service | Punctual to your doorstep |
| 4 | `ThumbsUp` | Satisfaction Guaranteed | 100% happiness or redo free |

### 4.1.6 Interaction

- Hover: card lifts 4px, shadow deepens to `shadow-card-md`.
- No click action. Badges are decorative trust signals, not links.
- On mobile, cards are static (no hover effect).

---

## 4.2 Customer Reviews Section

### 4.2.1 Section Container

| Property | Value |
|---|---|
| Background | `bg-white` |
| Padding | `py-14 md:py-20` |
| Max width | `max-w-7xl mx-auto px-4 md:px-8` |

### 4.2.2 Section Header

| Property | Value |
|---|---|
| Heading text | "What Our Customers Say" |
| Heading tag | `<h2>` |
| Font | `text-2xl md:text-3xl font-bold text-brand-maroon-800` |
| Alignment | Center on mobile, left-aligned on desktop |
| Bottom margin | `mb-10 md:mb-14` |

---

## 4.3 Rating Display (Left Column)

### 4.3.1 Layout

On desktop (>= 768px) the section is a two-column split:

| Column | Width | Content |
|---|---|---|
| Left | `w-full md:w-[280px] lg:w-[320px]` (fixed) | Rating block + social links |
| Right | `flex-1` | Review carousel |
| Gap | `gap-8 lg:gap-12` | |

On mobile (< 768px) the layout stacks vertically: rating block on top, carousel below.

### 4.3.2 Rating Number

| Element | Spec |
|---|---|
| Number | "4.9" |
| Font | `text-6xl md:text-7xl font-bold text-brand-maroon-800` |
| Line height | `leading-none` |

### 4.3.3 Star Icon

| Element | Spec |
|---|---|
| Icon | Single filled star, positioned to the right of the number |
| Size | `w-10 h-10` |
| Color | `text-brand-gold-500` (#FFD700) |
| Fill | Solid fill, not outline |
| Vertical alignment | Centered with the top half of the number |

### 4.3.4 Review Count

| Element | Spec |
|---|---|
| Text | "500+ reviews" |
| Font | `text-lg text-muted-foreground font-medium` |
| Margin | `mt-2` below the rating row |

### 4.3.5 Five-Star Summary (Optional Enhancement)

Below the review count, display a compact five-star breakdown bar:

| Stars | Bar width (relative) | Count label |
|---|---|---|
| 5 stars | 82% | 410 |
| 4 stars | 12% | 60 |
| 3 stars | 4% | 20 |
| 2 stars | 1.4% | 7 |
| 1 star | 0.6% | 3 |

Bar color: `bg-brand-gold-500`. Track color: `bg-gray-200`. Bar height: `h-2 rounded-full`. Font: `text-xs text-muted-foreground`. This element is optional for V1 and may be deferred.

### 4.3.6 Social Links

| Element | Spec |
|---|---|
| Label | "Let's Get Social" |
| Label font | `text-sm font-semibold text-brand-maroon-700 tracking-wide uppercase` |
| Margin | `mt-6` below review count |
| Icons | Instagram, WhatsApp |
| Icon size | `w-8 h-8` |
| Icon container | `flex gap-3 mt-2` |
| Icon style | Rounded square background `bg-brand-maroon-50`, icon `text-brand-maroon-500` |
| Hover | Background transitions to `bg-brand-maroon-100` |
| Links | Instagram: `https://instagram.com/glamornate` / WhatsApp: `https://wa.me/919XXXXXXXXX` (placeholder) |
| Accessibility | Each icon has `aria-label="Follow us on Instagram"` / `aria-label="Chat on WhatsApp"` |

---

## 4.4 Review Card Spec

### 4.4.1 Card Dimensions

| Property | Value |
|---|---|
| Min width | `min-w-[300px]` |
| Max width | `max-w-[340px]` |
| Height | Auto (content-driven), approx 200-240px |
| Padding | `p-5 md:p-6` |
| Border radius | `rounded-card-lg` (1rem) |
| Background | `bg-white` |
| Border | `border border-gray-100` |
| Shadow (default) | `shadow-card-sm` |
| Shadow (hover) | `shadow-card-md` |
| Transition | `transition-shadow duration-300` |

### 4.4.2 Card Interior Layout

Top-to-bottom stack:

```
[Avatar 48px] [Name + Rating]    <- row, items-center, gap-3
[Review text]                     <- block, mt-3
```

### 4.4.3 Avatar

| Property | Value |
|---|---|
| Size | `w-12 h-12` (48px) |
| Shape | `rounded-full` |
| Source | `https://ui-avatars.com/api/?name={FirstName}+{LastName}&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Alt text | `"{Full Name}'s photo"` |
| Fallback | CSS initials circle (`bg-brand-maroon-500 text-white text-sm font-bold`) if image fails to load |

Note: The `background=880E4F` parameter uses the brand maroon-500 hex without the leading `#` for URL compatibility.

### 4.4.4 Name

| Property | Value |
|---|---|
| Font | `text-sm font-semibold text-brand-maroon-800` |
| Truncation | Single line, `truncate` |

### 4.4.5 Star Rating

| Property | Value |
|---|---|
| Total stars | 5 |
| Filled star | `text-brand-gold-500` (solid fill) |
| Empty star | `text-gray-300` (outline or faded fill) |
| Star size | `w-4 h-4` (16px) |
| Gap | `gap-0.5` |
| Position | Below the reviewer name, `mt-0.5` |

### 4.4.6 Review Text

| Property | Value |
|---|---|
| Font | `text-sm text-gray-600 leading-relaxed` |
| Clamp | `line-clamp-4` (max 4 visible lines, ellipsis on overflow) |
| Margin | `mt-3` |
| Quotes | Wrapped in curly double quotes (Unicode `\u201C` ... `\u201D`) |

---

## 4.5 Carousel Behavior

### 4.5.1 Scroll Container

| Property | Value |
|---|---|
| Element | `<div role="region" aria-roledescription="carousel" aria-label="Customer reviews">` |
| Overflow | `overflow-x-auto` with `-webkit-overflow-scrolling: touch` |
| Scroll snap | `scroll-snap-type: x mandatory` on container; `scroll-snap-align: start` on each card |
| Gap | `gap-4 md:gap-6` between cards |
| Padding | `pb-4` (room for shadow below cards) |
| Scrollbar | Hidden via `scrollbar-hide` utility or `-ms-overflow-style: none; scrollbar-width: none; &::-webkit-scrollbar { display: none }` |

### 4.5.2 Auto-Advance

| Property | Value |
|---|---|
| Interval | 5000ms (5 seconds) |
| Direction | Scroll right by one card width + gap |
| Pause triggers | Mouse hover over carousel, touch/drag in progress, keyboard focus within carousel |
| Resume | After mouse leaves or touch ends, restart 5s timer |
| End behavior | Loop -- when the last card is reached, smoothly scroll back to the first card |

### 4.5.3 Navigation Arrows

| Property | Value |
|---|---|
| Visibility | Hidden on mobile (< 768px); visible on tablet and desktop |
| Shape | Circle, `w-10 h-10 rounded-full` |
| Border | `border-2 border-brand-maroon-400` |
| Background | `bg-white` default, `bg-brand-maroon-50` on hover |
| Icon | Chevron left / Chevron right, `w-5 h-5 text-brand-maroon-500` |
| Position | Vertically centered on the carousel, left arrow at the left edge (overlapping cards by 50%), right arrow at the right edge |
| Disabled state | `opacity-40 cursor-not-allowed` when at start (left) or end (right) -- only if loop is disabled |
| Click action | Scroll by exactly one card width + gap, with `scroll-behavior: smooth` |
| Focus ring | `focus-visible:ring-2 ring-brand-maroon-300 ring-offset-2` |

### 4.5.4 Pagination Counter

| Property | Value |
|---|---|
| Format | `"{current} / {total}"` e.g., "3 / 8" |
| Font | `text-sm font-medium text-muted-foreground` |
| Position | Below the carousel, center-aligned |
| Margin | `mt-4` |
| Update trigger | Updates on scroll snap settle (use `scrollend` event or IntersectionObserver) |

### 4.5.5 Peek Effect (Desktop)

On desktop viewports (>= 1024px), the rightmost visible card should be partially clipped (approximately 30% visible) to signal that more content exists to the right. Achieved by setting the scroll container width so it does not fully contain the last visible card.

---

## 4.6 Content Spec -- Review Data

All 8 reviews. The component renders these from a static array. No API call required for V1.

### Review 1
| Field | Value |
|---|---|
| Name | Priya Sharma |
| Rating | 5 |
| Avatar URL | `https://ui-avatars.com/api/?name=Priya+Sharma&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Text | "I booked a bridal facial package for my wedding week and the results were absolutely stunning. My skin was glowing on the big day. The beautician was gentle, professional, and used only premium products." |

### Review 2
| Field | Value |
|---|---|
| Name | Ankit Mehta |
| Rating | 5 |
| Avatar URL | `https://ui-avatars.com/api/?name=Ankit+Mehta&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Text | "Got a deep tissue massage after a long work trip. The therapist was punctual, set up the bed in minutes, and the pressure was perfect. Way better than the spa I used to visit in town." |

### Review 3
| Field | Value |
|---|---|
| Name | Deepika Verma |
| Rating | 4 |
| Avatar URL | `https://ui-avatars.com/api/?name=Deepika+Verma&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Text | "Really happy with the full-body waxing service. The beautician used fresh wax strips and was very careful around sensitive areas. Only reason for 4 stars is the appointment ran 15 minutes late." |

### Review 4
| Field | Value |
|---|---|
| Name | Surbhi Kapoor |
| Rating | 5 |
| Avatar URL | `https://ui-avatars.com/api/?name=Surbhi+Kapoor&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Text | "Glamornate is my go-to for monthly facials. They always use sealed product packs -- I can see them opening it fresh in front of me. That level of hygiene is rare and I appreciate it so much." |

### Review 5
| Field | Value |
|---|---|
| Name | Rahul Dutta |
| Rating | 4 |
| Avatar URL | `https://ui-avatars.com/api/?name=Rahul+Dutta&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Text | "Booked a head massage and hair spa combo for my mother as a birthday surprise. She absolutely loved it. The therapist was warm and patient. Will definitely book again for special occasions." |

### Review 6
| Field | Value |
|---|---|
| Name | Meenakshi Thakur |
| Rating | 5 |
| Avatar URL | `https://ui-avatars.com/api/?name=Meenakshi+Thakur&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Text | "I was nervous about trying at-home beauty services but Glamornate made me feel completely comfortable. The Ayurvedic facial was heavenly and my skin felt amazing for days afterward. Highly recommend." |

### Review 7
| Field | Value |
|---|---|
| Name | Kavita Gupta |
| Rating | 5 |
| Avatar URL | `https://ui-avatars.com/api/?name=Kavita+Gupta&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Text | "Used Glamornate for my sister's mehndi night -- group booking for 6 people. Every single beautician arrived on time and the makeup was flawless. The coordinator kept everything running smoothly." |

### Review 8
| Field | Value |
|---|---|
| Name | Arjun Bhat |
| Rating | 4 |
| Avatar URL | `https://ui-avatars.com/api/?name=Arjun+Bhat&background=880E4F&color=fff&size=96&font-size=0.4&bold=true` |
| Text | "Solid experience with the men's grooming package. Clean shave, beard trim, and a refreshing face massage all done in about 45 minutes at home. Convenient and well-priced compared to local salons." |

---

## 4.7 Responsive Behavior

### 4.7.1 Breakpoint Summary

| Breakpoint | Trust Badges | Rating Display | Carousel |
|---|---|---|---|
| Mobile (< 640px) | 2x2 grid | Full width, center-aligned, stacked above carousel | Full-width cards, swipe-only, arrows hidden, pagination visible |
| Tablet (640-767px) | 4-across row | Full width, center-aligned, stacked above carousel | Cards at `min-w-[300px]`, arrows visible, pagination visible |
| Tablet-landscape (768-1023px) | 4-across row | Left column 280px, right column flex-1 | Arrows visible, 2 full cards + peek |
| Desktop (>= 1024px) | 4-across row | Left column 320px, right column flex-1 | Arrows visible, 2-3 full cards + peek, auto-advance active |

### 4.7.2 Mobile-Specific Adjustments

- Carousel arrows are hidden. Navigation is swipe-only.
- Cards expand to `w-[85vw]` so one card is nearly full-width with a sliver of the next card visible.
- Auto-advance is paused by default on mobile to respect touch interaction patterns. It activates only after the user has swiped at least once (opt-in behavior).
- Rating display: the number, star, and review count are centered. Social icons are centered below.
- Trust badges: the 2x2 grid has `gap-3` on mobile for tighter spacing.

### 4.7.3 Tablet and Desktop

- Side-by-side layout for rating + carousel.
- Arrow buttons appear at the carousel edges.
- Auto-advance runs from page load.
- Peek effect: the rightmost card is 30% clipped on desktop, 15% clipped on tablet.

---

## 4.8 Accessibility

### 4.8.1 Carousel ARIA

| Element | Attribute | Value |
|---|---|---|
| Scroll container | `role` | `region` |
| Scroll container | `aria-roledescription` | `carousel` |
| Scroll container | `aria-label` | `Customer reviews` |
| Each review card | `role` | `group` |
| Each review card | `aria-roledescription` | `slide` |
| Each review card | `aria-label` | `Review {index} of {total} by {name}` |
| Left arrow | `aria-label` | `Previous review` |
| Right arrow | `aria-label` | `Next review` |
| Pagination | `aria-live` | `polite` |
| Pagination | `aria-atomic` | `true` |

### 4.8.2 Auto-Advance and Focus

- Auto-advance pauses when any element inside the carousel receives keyboard focus.
- Auto-advance pauses when the user activates a screen reader's virtual cursor inside the carousel region.
- A visually hidden "Pause auto-scroll" toggle button is present inside the carousel region for users who cannot hover. When activated it sets `aria-pressed="true"` and stops the timer permanently until toggled again.

### 4.8.3 Keyboard Navigation

| Key | Behavior |
|---|---|
| Tab | Moves focus to the next interactive element (arrow buttons, social links, pause button) |
| Arrow Left / Arrow Right | When an arrow button is focused, activating it scrolls by one card |
| Enter / Space | Activates the focused arrow button or pause toggle |

### 4.8.4 Star Ratings

- Each star rating row uses `aria-label="Rated {n} out of 5 stars"` on the container element.
- Individual star icons are `aria-hidden="true"` since the container label conveys the information.

### 4.8.5 Reduced Motion

- When `prefers-reduced-motion: reduce` is active, auto-advance is disabled entirely.
- Scroll behavior falls back to instant snapping (no smooth scroll animation).
- Hover lift on trust badges is disabled.

---

## 4.9 Animation and Transitions

### 4.9.1 Section Entrance

Both the Trust Badges section and the Reviews section use a scroll-triggered fade-in-up animation:

| Property | Value |
|---|---|
| Animation | `animate-fade-in-up` (from tailwind config) |
| Trigger | IntersectionObserver, threshold 0.15 |
| Initial state | `opacity-0 translate-y-4` |
| Final state | `opacity-1 translate-y-0` |
| Duration | 500ms |
| Easing | `ease-out` |
| Stagger | Trust badge cards stagger by 100ms each (badge 1 at 0ms, badge 2 at 100ms, badge 3 at 200ms, badge 4 at 300ms) |

### 4.9.2 Card Hover

Review cards on desktop:

| Property | Default | Hover |
|---|---|---|
| Shadow | `shadow-card-sm` | `shadow-card-md` |
| Transform | none | `translateY(-2px)` |
| Transition | `transition-all duration-300 ease-out` | -- |

### 4.9.3 Carousel Scroll

| Property | Value |
|---|---|
| Scroll behavior | `scroll-behavior: smooth` |
| Snap type | `scroll-snap-type: x mandatory` |
| Snap align | `scroll-snap-align: start` on each card |
| Auto-advance transition | Programmatic `scrollBy()` with `behavior: 'smooth'` |

---

## 4.10 Component Hierarchy

Suggested component tree for implementation:

```
<TrustBadgesSection>
  <SectionHeader heading="Why Customers Trust Glamornate" subheading="Trusted by 500+ customers in Jammu" />
  <BadgeGrid>
    <TrustBadge icon={ShieldCheck} label="Verified Professionals" subtitle="Background-checked & trained" />
    <TrustBadge icon={Sparkles} label="Hygienic Products" subtitle="Sealed packs, premium brands" />
    <TrustBadge icon={Clock} label="On-Time Service" subtitle="Punctual to your doorstep" />
    <TrustBadge icon={ThumbsUp} label="Satisfaction Guaranteed" subtitle="100% happiness or redo free" />
  </BadgeGrid>
</TrustBadgesSection>

<CustomerReviewsSection>
  <SectionHeader heading="What Our Customers Say" />
  <ReviewsLayout>                               <!-- flex row on desktop, stack on mobile -->
    <RatingDisplay>
      <AggregateRating value={4.9} />           <!-- large number + gold star -->
      <ReviewCount count="500+" />
      <StarBreakdown />                         <!-- optional V1 -->
      <SocialLinks />                           <!-- Instagram + WhatsApp -->
    </RatingDisplay>
    <ReviewCarousel>
      <ReviewCard ... /> x 8                    <!-- snap-scroll container -->
      <CarouselArrows />                        <!-- hidden mobile -->
      <PaginationCounter current={n} total={8} />
    </ReviewCarousel>
  </ReviewsLayout>
</CustomerReviewsSection>
```

---

## 4.11 Data Model (Static V1)

No backend API required for V1. Reviews are stored as a static constant array.

```ts
interface ReviewData {
  readonly id: string;
  readonly name: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly text: string;
  readonly avatarUrl: string;
}

interface TrustBadgeData {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly subtitle: string;
}

interface AggregateRating {
  readonly score: number;       // 4.9
  readonly totalReviews: string; // "500+"
}
```

Future iterations may source reviews from Firestore with moderation flags, verified-purchase badges, and date stamps.

---

## 4.12 Performance Considerations

| Concern | Mitigation |
|---|---|
| Avatar images (8 external requests) | Use `loading="lazy"` on all avatar `<img>` tags. Avatars are small (96x96) and served by ui-avatars.com with CDN caching. |
| Auto-advance timer leak | Clear interval on component unmount. Use `useRef` for the timer ID to avoid stale closures. |
| Scroll event performance | Use `IntersectionObserver` to detect the active card rather than listening to `scroll` events. Pagination counter updates passively. |
| Layout shift (CLS) | Set explicit `min-h` on the review section container to reserve vertical space before cards render. |
| Bundle size | The review data array (~2KB) is inlined in the component module. No additional data-fetching library needed. |

---

## 4.13 Design Tokens Reference

All color and shadow tokens reference the existing Tailwind config at `/frontend/tailwind.config.ts`:

| Token used in this section | Source |
|---|---|
| `brand-maroon-50` through `brand-maroon-950` | `theme.extend.colors.brand.maroon.*` |
| `brand-gold-500` | `theme.extend.colors.brand.gold.500` |
| `shadow-card-sm`, `shadow-card-md`, `shadow-card-lg` | `theme.extend.boxShadow.card-*` |
| `shadow-maroon` | `theme.extend.boxShadow.maroon` |
| `rounded-card`, `rounded-card-lg` | `theme.extend.borderRadius.card*` |
| `animate-fade-in-up` | `theme.extend.animation.fade-in-up` |
| `text-muted-foreground` | `theme.extend.colors.muted.foreground` |

---

## 4.14 Acceptance Criteria

- [ ] Trust Badges section renders 4 badges in a 2x2 grid on mobile and 4-across on desktop.
- [ ] Each badge displays the correct icon, label, and subtitle per Section 4.1.5.
- [ ] Badge cards lift on hover (desktop only) with shadow transition.
- [ ] Rating display shows "4.9" in large bold text with a gold filled star.
- [ ] "500+ reviews" text appears below the rating.
- [ ] Social links (Instagram, WhatsApp) render with correct icons and open in new tabs.
- [ ] Review carousel renders all 8 review cards with correct name, rating, avatar, and text.
- [ ] Carousel scrolls horizontally with snap behavior.
- [ ] Auto-advance moves one card every 5 seconds on desktop.
- [ ] Auto-advance pauses on hover, touch, and keyboard focus.
- [ ] Left/right arrow buttons scroll by one card (hidden on mobile).
- [ ] Pagination counter shows correct "{current} / 8" and updates on scroll.
- [ ] Peek effect shows a partial card on the right edge (desktop).
- [ ] On mobile, cards are swipeable and approximately 85vw wide.
- [ ] All ARIA attributes from Section 4.8 are present and correct.
- [ ] `prefers-reduced-motion` disables auto-advance and smooth scrolling.
- [ ] Section entrance animations trigger on scroll into viewport.
- [ ] No layout shift (CLS) when the section loads.
- [ ] Avatar images use `loading="lazy"`.
- [ ] Auto-advance timer is cleaned up on component unmount.

---

## 4.15 Out of Scope (V1)

- Fetching reviews from Firestore or any external API.
- Verified-purchase badges on review cards.
- Review submission form or "Write a Review" CTA.
- Media coverage / press logo grid (to be added when press mentions are available).
- Celebrity video testimonial carousel (Yes Madam feature, not applicable for V1).
- Star breakdown bar chart (deferred, see Section 4.3.5).
- Review filtering or sorting controls.
- Review date stamps.

---

*End of Section 4*
