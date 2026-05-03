# PRD Section 5 -- App Download CTA + Comprehensive Footer + SEO Content

**Project:** Glamornate Website Redesign (Yes Madam-Inspired)
**Section:** 5 of N
**Date:** 2026-04-10
**Status:** Draft

---

## Table of Contents

1. [Booking CTA Section](#1-booking-cta-section)
2. [FAQ Section](#2-faq-section)
3. [Service Area / Cities Section](#3-service-area--cities-section)
4. [SEO Content Accordion](#4-seo-content-accordion)
5. [Footer Layout](#5-footer-layout)
6. [Footer Content](#6-footer-content)
7. [Bottom Bar](#7-bottom-bar)
8. [WhatsApp Floating Button](#8-whatsapp-floating-button)
9. [Back to Top Button](#9-back-to-top-button)

---

## 1. Booking CTA Section

### 1.1 Purpose

Convert browsing visitors into first-time customers. This section replaces the typical "Download Our App" pattern (used by Yes Madam) with a web-first "Book Your First Service" call to action, since Glamornate does not have a standalone mobile app.

### 1.2 Layout

**Container:** Full-width section with `brand-maroon-50` (`#FDF2F8`) background color. Inner content constrained to the global container max-width (`1400px`, centered).

**Grid:** Two-column split layout.

| Property | Left Column (Image) | Right Column (Form) |
|---|---|---|
| Width (desktop) | 50% | 50% |
| Width (tablet, <1024px) | 100% (stacked above) | 100% (stacked below) |
| Width (mobile, <768px) | 100% (stacked above) | 100% (stacked below) |
| Vertical alignment | Center | Center |
| Horizontal padding | 0 (image bleeds to column edge) | 40px desktop, 24px tablet, 16px mobile |

### 1.3 Left Column -- Hero Image

- **Content:** High-quality photograph of a smiling professional performing a treatment, or a relaxed client receiving a service. The image should convey warmth, professionalism, and luxury.
- **Aspect ratio:** 4:3 on desktop, 16:9 on mobile (use `object-cover` and `object-center`).
- **Sizing:** Fill the full height of the section on desktop (min-height `480px`, max-height `600px`). On mobile, fixed height of `280px`.
- **Border radius:** `rounded-card-lg` (`1rem`) on the right side only on desktop. Full `rounded-card-lg` on mobile.
- **Fallback:** Skeleton shimmer placeholder (brand-maroon-100 base, brand-maroon-200 shimmer) while the image loads. Use Next.js `<Image>` with `priority={false}` and `placeholder="blur"`.

### 1.4 Right Column -- CTA Form

**Heading:**
- Text: "Your Salon Experience, at Home"
- Font: `font-serif`, `text-3xl` (desktop) / `text-2xl` (mobile)
- Color: `brand-maroon-900` (`#4A062A`)
- Weight: `font-bold`
- Margin-bottom: `8px`

**Subtitle:**
- Text: "Book your first service and get 15% off"
- Font: `font-sans`, `text-lg` (desktop) / `text-base` (mobile)
- Color: `brand-maroon-700` (`#6D0A3E`)
- Weight: `font-normal`
- Margin-bottom: `32px`

**Input Field:**
- Single text input for phone number or email address
- Placeholder text: "Enter your phone or email"
- Border: `1px solid brand-maroon-200`, `rounded-md`
- Focus state: `ring-2 ring-brand-maroon-400 border-brand-maroon-400`
- Height: `48px`
- Font size: `text-base`
- Width: `100%`, max-width `400px`
- Margin-bottom: `16px`

**"Get Started" Button:**
- Text: "Get Started"
- Background: `brand-maroon-500` (`#880E4F`)
- Text color: `white`
- Font weight: `font-semibold`
- Padding: `14px 32px`
- Border radius: `rounded-pill` (`9999px`)
- Height: `48px`
- Width: matches the input field width
- Hover state: `brand-maroon-600` (`#7B0C47`), `shadow-maroon`
- Active state: `brand-maroon-700` (`#6D0A3E`), `scale-[0.98]`
- Transition: `transition-all duration-200 ease-out`
- Margin-bottom: `16px`

**Secondary Link:**
- Text: "Or browse services directly"
- Rendered as a text link with right-arrow icon (`ChevronRight`, 16px)
- Color: `brand-maroon-500`, underline on hover
- Links to: `/services`
- Font size: `text-sm`

### 1.5 Responsive Stacking

| Breakpoint | Behavior |
|---|---|
| >= 1024px (lg) | Side-by-side: image left, form right |
| 768px - 1023px (md) | Stacked: image on top (height 320px), form below with centered content |
| < 768px (sm) | Stacked: image on top (height 280px), form below with left-aligned content, full-width input and button |

### 1.6 Section Spacing

- Vertical padding: `py-16` (desktop), `py-12` (tablet), `py-10` (mobile)
- Gap between columns: `gap-12` (desktop), `gap-8` (stacked)

---

## 2. FAQ Section

### 2.1 Purpose

Address common customer objections and questions to reduce friction before booking. Also provides structured data for Google FAQ rich snippets (`FAQPage` schema).

### 2.2 Section Header

- **Heading:** "Frequently Asked Questions"
- Font: `font-serif`, `text-3xl` (desktop) / `text-2xl` (mobile)
- Color: `brand-maroon-900`
- Weight: `font-bold`
- Text alignment: center
- Margin-bottom: `40px` (desktop), `32px` (mobile)

### 2.3 Accordion Design

**Container:** Max-width `800px`, centered horizontally within the section.

**Each Accordion Item:**

| Property | Specification |
|---|---|
| Trigger row height | Min `56px`, expands with text wrapping |
| Trigger padding | `16px 20px` |
| Trigger background (closed) | `white` |
| Trigger background (open) | `brand-maroon-50` (`#FDF2F8`) |
| Border | `1px solid` `border` token (gray-200 equivalent) |
| Border radius | `rounded-card` (`0.75rem`) per item |
| Gap between items | `12px` |
| Question font | `font-sans`, `text-base`, `font-semibold`, `brand-maroon-900` |
| Answer font | `font-sans`, `text-sm` (desktop `text-base`), `font-normal`, `muted-foreground` |
| Answer padding | `0 20px 16px 20px` |
| Chevron icon | Right-aligned, 20px, `brand-maroon-500`. Rotates 180 degrees on open with `transition-transform duration-200` |

**Behavior:**
- Only one item open at a time (single-expand mode). Opening a new item closes the previously open item.
- Uses Radix UI `<Accordion type="single" collapsible>` under the hood (consistent with existing accordion keyframes in the design system).
- Content area animates with the existing `accordion-down` / `accordion-up` keyframes (0.2s ease-out).
- First item is open by default on page load.

### 2.4 FAQ Content (10 Items)

**Q1: What services does Glamornate offer?**
A: Glamornate offers a wide range of at-home salon and spa services including facials, hair care (haircuts, coloring, treatments), waxing, manicures, pedicures, bridal makeup, party makeup, body massages, and complete grooming packages. All services are performed by trained, verified professionals using premium salon-grade products.

**Q2: How do I book a service on Glamornate?**
A: Booking is simple. Browse our services page, select the service you want, pick your preferred date and time slot, and confirm your booking. You can book through our website on any device. You will receive an instant confirmation via SMS and email with your booking details and professional's information.

**Q3: Are your professionals trained and verified?**
A: Yes. Every Glamornate professional undergoes a thorough background verification, skill assessment, and training program before being onboarded. Our professionals have a minimum of 2 years of salon experience and are trained in hygiene protocols, premium product usage, and customer service standards.

**Q4: What is your cancellation and refund policy?**
A: You can cancel a booking for free up to 4 hours before the scheduled time. Cancellations made less than 4 hours before the appointment may incur a cancellation fee of up to 25% of the service cost. If you are unsatisfied with a completed service, contact us within 24 hours and we will arrange a redo or process a refund as appropriate.

**Q5: What products do your professionals use?**
A: We use only premium, salon-grade products from trusted brands. All products are hypoallergenic and dermatologist-tested. For facials and skin treatments, we use brands suitable for Indian skin types. If you have allergies or product preferences, let us know during booking and we will accommodate.

**Q6: How is pricing determined? Are there hidden charges?**
A: All service prices are listed transparently on our website. The price you see is the price you pay -- there are no hidden charges, surge pricing, or additional fees. We offer seasonal discounts, combo packages, and a first-booking discount of 15% off to make premium services accessible.

**Q7: Which areas does Glamornate currently serve?**
A: We currently serve Jammu city and surrounding areas. We are actively expanding to Delhi NCR and other major cities across India. Enter your pin code during booking to check if we service your area. Join our waitlist for notifications when we launch in your city.

**Q8: What safety and hygiene measures do you follow?**
A: Hygiene is our top priority. Every professional carries a sanitized, sealed kit for each appointment. All tools are sterilized between uses. Professionals wear gloves and masks for applicable services. We follow a strict no-reuse policy for consumables like wax strips, cotton, and applicators.

**Q9: Can I book services for a group or event?**
A: Absolutely. Glamornate offers group bookings for events like weddings, bridal showers, kitty parties, and corporate wellness days. Contact us through the website or WhatsApp to discuss group packages. We offer dedicated event coordinators for bookings of 5 or more people.

**Q10: How do I become a Glamornate partner professional?**
A: If you are a skilled beauty or wellness professional, you can apply through our "Register as Partner" page. We review applications within 48 hours. Approved partners receive training, a starter kit, access to our booking platform, and guaranteed minimum earnings during the onboarding period.

### 2.5 Structured Data

The FAQ section must output a `<script type="application/ld+json">` block with `FAQPage` schema markup containing all Q&A pairs. This is rendered server-side (RSC) for SEO crawler access.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What services does Glamornate offer?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Glamornate offers a wide range of at-home salon and spa services..."
      }
    }
  ]
}
```

### 2.6 Section Spacing

- Background color: `white` (default page background)
- Vertical padding: `py-16` (desktop), `py-12` (mobile)
- Section id: `#faq` (for anchor linking from the navbar or footer)

---

## 3. Service Area / Cities Section

### 3.1 Purpose

Build local trust and communicate geographic availability. Provides location-based SEO signals.

### 3.2 Layout

**Container:** Full-width section with `brand-maroon-900` (`#4A062A`) background. Inner content constrained to global container max-width.

**Badge Row (top):**
- Left element: Indian flag emoji or small flag SVG icon (20px x 14px), followed by text "100% Made in India Brand"
- Font: `font-sans`, `text-sm`, `font-medium`, `brand-gold-400` (`#FDE047`)
- Alignment: center
- Margin-bottom: `16px`

**Heading:**
- Text: "Proudly Serving Jammu & Beyond"
- Font: `font-serif`, `text-2xl` (desktop) / `text-xl` (mobile)
- Color: `white`
- Weight: `font-bold`
- Text alignment: center
- Margin-bottom: `24px`

### 3.3 City List

**Format:** Inline list of city names separated by a vertical pipe character (` | `) with `brand-maroon-400` color for the pipe.

**Cities (current + expansion roadmap):**
Jammu | Srinagar | Delhi | Noida | Gurugram | Faridabad | Ghaziabad | Chandigarh | Amritsar | Ludhiana | Lucknow | Jaipur | Mumbai | Pune | Bangalore | Hyderabad | Chennai | Kolkata | Ahmedabad | Indore | Bhopal | Kochi | Patna | Dehradun

- Active cities (currently served): rendered in `white`, `font-semibold`
- Future cities (expansion planned): rendered in `brand-maroon-300` (`#F9A8D4`), `font-normal`
- Initially, only "Jammu" is the active city. All others are future expansion.
- City names wrap naturally on smaller screens. Use `flex flex-wrap justify-center gap-x-2 gap-y-1`.

**City text:**
- Font: `font-sans`, `text-sm`
- Pipe separator: `brand-maroon-400`, `font-light`

### 3.4 Section Spacing

- Vertical padding: `py-10` (desktop), `py-8` (mobile)
- The section sits between the FAQ section (above) and the footer (below)

---

## 4. SEO Content Accordion

### 4.1 Purpose

Provide long-form keyword-rich content for search engine indexing without cluttering the visible page for users. Mirrors the "More About Yes Madam Services" pattern.

### 4.2 Layout

**Container:** Full-width section with `section-bg` background (`#F5F5F5` in light mode). Inner content constrained to global container max-width.

**Heading:**
- Text: "More About Glamornate Services"
- Font: `font-serif`, `text-xl`, `font-bold`, `brand-maroon-900`
- Alignment: left
- Margin-bottom: `16px`

### 4.3 Expandable Content Area

**Collapsed state (default):**
- Shows the first 4 lines (~280 characters) of the SEO content with a vertical gradient fade (transparent at top, `section-bg` at bottom) masking the overflow.
- "Read More" toggle button below the faded text.

**Expanded state:**
- Full content visible. Gradient mask removed.
- "Read Less" toggle button at the bottom.

**Toggle button:**
- Text: "Read More" / "Read Less" with chevron-down / chevron-up icon (16px)
- Font: `font-sans`, `text-sm`, `font-semibold`, `brand-maroon-500`
- No background, no border (text-button style)
- Hover: underline
- Transition: content area height animates with `transition-[max-height] duration-300 ease-in-out`

### 4.4 SEO Content (Placeholder)

The content block should be populated with approximately 800-1200 words covering the following topics. The actual copy will be finalized by the content team, but the structure must accommodate:

- **Paragraph 1:** Introduction to Glamornate as an at-home salon and spa service provider in Jammu, India. Mention the founding vision, the gap in the market for premium at-home beauty services in Tier-2 cities.
- **Paragraph 2:** Overview of service categories -- facials, hair care, waxing, nail care, bridal packages, body massages. Mention that all services use salon-grade products.
- **Paragraph 3:** The Glamornate professional guarantee -- background verification, skill certification, hygiene protocols, insurance coverage.
- **Paragraph 4:** Service areas and expansion -- currently serving Jammu, planned expansion to Delhi NCR, Chandigarh, Amritsar, and other Northern India cities.
- **Paragraph 5:** Booking process walkthrough -- browse services, select date/time, confirm, professional arrives at your door.
- **Paragraph 6:** Pricing philosophy -- transparent pricing, no hidden fees, seasonal offers, loyalty rewards.
- **Paragraph 7:** Glamornate for events -- weddings, pre-wedding, bridal showers, corporate wellness.
- **Paragraph 8:** Technology and platform -- built for modern users, fast booking, real-time tracking, secure payments.

The content must be rendered as semantic HTML (`<article>` with `<p>` tags) for crawler readability. No JavaScript-dependent rendering for the collapsed content -- the full text must be present in the DOM (hidden via CSS `max-height` + `overflow: hidden`, not via conditional rendering).

### 4.5 Section Spacing

- Vertical padding: `py-12` (desktop), `py-8` (mobile)
- Sits between the Cities section (above) and the Footer (below)

---

## 5. Footer Layout

### 5.1 Purpose

Provide comprehensive site navigation, legal links, contact information, and social proof. The footer is the final trust-building element on every page.

### 5.2 Background and Container

- Background color: `brand-maroon-950` (`#2D0419`) -- deepest maroon, near-black
- Full-width background, inner content constrained to global container max-width (`1400px`)
- Vertical padding: `pt-16 pb-8` (desktop), `pt-12 pb-6` (mobile)
- All text defaults to `brand-maroon-100` (`#FCE7F3`) for readability against the dark background

### 5.3 Grid Layout

**Desktop (>=1024px):** 4-column grid with `grid-cols-4` and `gap-8`

| Column | Width | Content |
|---|---|---|
| 1 | ~30% (`col-span-1`, slightly wider) | About Glamornate |
| 2 | ~20% | Quick Links |
| 3 | ~20% | Legal |
| 4 | ~30% | Get in Touch |

**Tablet (768px - 1023px):** 2x2 grid with `grid-cols-2` and `gap-8`

| Row | Left | Right |
|---|---|---|
| 1 | About Glamornate | Quick Links |
| 2 | Legal | Get in Touch |

**Mobile (<768px):** Single column stack with `grid-cols-1` and `gap-10`. Each column section gets a horizontal divider (`border-t border-brand-maroon-800`) between them except the first.

### 5.4 Column Heading Style

- Font: `font-sans`, `text-base`, `font-bold`, `uppercase`, `tracking-wide`
- Color: `white`
- Margin-bottom: `20px`
- Letter-spacing: `0.05em`

### 5.5 Column Link Style

- Font: `font-sans`, `text-sm`, `font-normal`
- Color: `brand-maroon-200` (`#FBCFE8`)
- Hover color: `white`
- Hover transform: `translateX(4px)` with `transition-all duration-150`
- Line height: `leading-relaxed` (1.625)
- List style: `flex flex-col gap-3`
- No underline by default, underline on hover

### 5.6 Social Icon Style

- Size: `24px` x `24px` (touch target `44px` x `44px` with padding)
- Color: `brand-maroon-200`, hover `white`
- Arrangement: horizontal row with `gap-4`
- Transition: `transition-colors duration-150`
- Icons: use Lucide React icon set (consistent with existing codebase) for Instagram, Facebook. Use custom SVG for WhatsApp.

---

## 6. Footer Content

### 6.1 Column 1 -- About Glamornate

**Heading:** "About Glamornate"

**Logo:** Glamornate wordmark/logo displayed above the description. Height `32px`, white variant. If no white variant exists, use a CSS `brightness(0) invert(1)` filter on the standard logo.

**Description paragraph:**
"Glamornate brings premium salon and spa services to your doorstep. Founded in Jammu, we are on a mission to make professional beauty and wellness accessible to everyone, everywhere. Our verified professionals deliver salon-quality results in the comfort of your home."

- Font: `font-sans`, `text-sm`, `brand-maroon-200`
- Line height: `leading-relaxed`
- Max-width: `320px` (prevents overly wide text on large screens)

### 6.2 Column 2 -- Quick Links

**Heading:** "Quick Links"

| Link Text | Href |
|---|---|
| Home | `/` |
| Services | `/services` |
| About Us | `/about` |
| Blog | `/blog` |
| Contact Us | `/contact` |
| Register as Partner | `/partner/register` |
| Careers | `/careers` |

### 6.3 Column 3 -- Legal

**Heading:** "Legal"

| Link Text | Href |
|---|---|
| Terms & Conditions | `/legal/terms` |
| Privacy Policy | `/legal/privacy` |
| Refund Policy | `/legal/refund` |
| Cancellation Policy | `/legal/cancellation` |

### 6.4 Column 4 -- Get in Touch

**Heading:** "Get in Touch"

**Contact items (each as a row with icon + text):**

| Icon | Text | Action |
|---|---|---|
| `Phone` (Lucide) | +91-XXXXX-XXXXX | `tel:+91XXXXXXXXXX` |
| `Mail` (Lucide) | support@glamornate.com | `mailto:support@glamornate.com` |
| `MessageCircle` (Lucide) | WhatsApp Us | `https://wa.me/91XXXXXXXXXX` |

- Icon size: `16px`, `brand-maroon-300`
- Text: `text-sm`, `brand-maroon-200`, hover `white`
- Gap between icon and text: `8px`
- Gap between rows: `12px`

**Hours:**
- Text: "Mon - Sun: 9:00 AM - 9:00 PM"
- Prefix icon: `Clock` (Lucide), `16px`
- Font: `text-xs`, `brand-maroon-300`
- Margin-top: `16px`

**Social Links:**
- Label: "Follow Us" (text-xs, brand-maroon-300, margin-bottom 8px)
- Icons in a horizontal row:

| Platform | Icon | Href (placeholder) |
|---|---|---|
| Instagram | Instagram icon (Lucide) | `https://instagram.com/glamornate` |
| Facebook | Facebook icon (Lucide) | `https://facebook.com/glamornate` |
| WhatsApp | Custom WhatsApp SVG | `https://wa.me/91XXXXXXXXXX` |

- Styling: per section 5.6 above

---

## 7. Bottom Bar

### 7.1 Layout

- Separated from the footer columns by a horizontal rule: `border-t border-brand-maroon-800`
- Margin-top: `40px` (desktop), `32px` (mobile)
- Padding-top: `24px`

### 7.2 Content

**Desktop:** Single row, flexbox `justify-between items-center`.

| Left | Right |
|---|---|
| Copyright text | Payment method icons (future, optional) |

**Mobile:** Single column, centered text.

### 7.3 Copyright Text

- Text: "2024-2026 Glamornate. All rights reserved."
- Font: `font-sans`, `text-xs`
- Color: `brand-maroon-400`

### 7.4 Payment Icons (Future Enhancement)

- Placeholder area for Visa, Mastercard, UPI, Paytm icons
- Size: `32px` height, auto width
- Opacity: `0.6`, hover `1.0`
- Not implemented in v1 -- reserve the layout slot

---

## 8. WhatsApp Floating Button

### 8.1 Purpose

Provide a persistent, easily accessible communication channel for visitors who prefer WhatsApp over form-based booking. WhatsApp is the dominant messaging platform for Glamornate's target demographic (India, Tier-2 cities).

### 8.2 Position and Sizing

- Position: `fixed`, `bottom-6 right-6` (desktop), `bottom-4 right-4` (mobile)
- z-index: `z-50`
- Button size: `56px` x `56px` (desktop), `48px` x `48px` (mobile)
- Shape: Circular (`rounded-full`)
- Touch target: meets the `56px` / `48px` minimum (inherent from button size)

### 8.3 Appearance

- Background: `#25D366` (official WhatsApp brand green)
- Icon: WhatsApp SVG icon, `white`, `28px` (desktop) / `24px` (mobile)
- Shadow: `0 4px 12px rgba(37, 211, 102, 0.4)`
- Hover shadow: `0 6px 20px rgba(37, 211, 102, 0.5)`
- Hover scale: `scale-110`
- Transition: `transition-all duration-200 ease-out`

### 8.4 "Chat Now" Label

- A small tooltip/badge appears to the left of the circular button.
- Text: "Chat Now"
- Background: `white`
- Text color: `gray-800`
- Font: `text-xs`, `font-medium`
- Padding: `4px 10px`
- Border radius: `rounded-pill`
- Shadow: `shadow-card-sm`
- Connected to the button by a small CSS triangle (optional) or positioned with `right: 64px` (desktop) / `right: 56px` (mobile).

### 8.5 First-Visit Bounce Animation

On the user's first page visit (tracked via `sessionStorage` flag `glamornate_wa_bounced`):

1. Button renders normally.
2. After a `3-second` delay, the button plays a gentle bounce animation for `3 iterations`:
   - Keyframes: `0%: translateY(0)`, `30%: translateY(-8px)`, `50%: translateY(0)`, `70%: translateY(-4px)`, `100%: translateY(0)`
   - Duration: `0.6s` per iteration
   - Timing: `ease-in-out`
3. After the animation completes, set `sessionStorage.glamornate_wa_bounced = "true"` to prevent re-triggering during the session.
4. The "Chat Now" label fades in simultaneously with the bounce and fades out `5 seconds` after the bounce ends.

### 8.6 Link Target

- Desktop: `https://wa.me/91XXXXXXXXXX?text=Hi%20Glamornate%2C%20I%20would%20like%20to%20book%20a%20service.`
- Mobile: Same URL. On mobile devices with WhatsApp installed, this opens the app directly.
- `target="_blank"`, `rel="noopener noreferrer"`
- `aria-label="Chat with Glamornate on WhatsApp"`

### 8.7 Visibility Rules

- Always visible on all pages except `/checkout` and `/payment` (to avoid distracting during payment flow).
- Hidden when the mobile bottom navigation bar is open (if implemented).
- Does not overlap with the Back to Top button (Back to Top is positioned `bottom-6 right-20` on desktop, or stacked vertically above WhatsApp on mobile with `bottom-[72px] right-4`).

---

## 9. Back to Top Button

### 9.1 Purpose

Allow users to quickly scroll back to the top of long pages (homepage, services listing, blog posts). Reduces friction on mobile where scroll-to-top is less intuitive.

### 9.2 Visibility Trigger

- Hidden by default.
- Appears when the user has scrolled down more than `2 viewport heights` (200vh / `window.innerHeight * 2`).
- Fades in with `opacity` transition over `200ms`.
- Fades out when scrolling back above the threshold.
- Scroll position tracked via `useEffect` + `scroll` event listener with `passive: true` and a `100ms` throttle (using `requestAnimationFrame`).

### 9.3 Position and Sizing

- Position: `fixed`
- Desktop: `bottom-6 right-20` (leaves space for WhatsApp button at `right-6`)
- Mobile: `bottom-[72px] right-4` (stacked above WhatsApp button which is at `bottom-4 right-4`)
- z-index: `z-40` (below WhatsApp button at z-50)
- Button size: `44px` x `44px`
- Shape: Circular (`rounded-full`)

### 9.4 Appearance

- Background: `white` with `border border-gray-200`
- Icon: `ChevronUp` (Lucide), `20px`, `brand-maroon-500`
- Shadow: `shadow-card-sm`
- Hover: `shadow-card-md`, `border-brand-maroon-300`, icon color `brand-maroon-700`
- Transition: `transition-all duration-200`

### 9.5 Scroll Behavior

- On click: `window.scrollTo({ top: 0, behavior: 'smooth' })`
- `aria-label="Scroll to top"`
- Keyboard accessible: focusable via tab, activates on Enter/Space

---

## Component File Structure

The following file organization is recommended for implementation. No files should be created as part of this PRD -- this is the target structure only.

```
src/
  components/
    sections/
      BookingCTA.tsx           # Section 1 -- Booking CTA with form
      FAQ.tsx                  # Section 2 -- FAQ accordion
      ServiceArea.tsx          # Section 3 -- Cities bar
      SEOContent.tsx           # Section 4 -- SEO expandable content
    layout/
      Footer.tsx               # Section 5 + 6 + 7 -- Full footer with columns and bottom bar
    floating/
      WhatsAppButton.tsx       # Section 8 -- WhatsApp floating CTA
      BackToTopButton.tsx      # Section 9 -- Scroll-to-top button
  data/
    faq-data.ts                # FAQ Q&A content array (typed, exported)
    footer-links.ts            # Footer link definitions (typed, exported)
    cities-data.ts             # City list with active/future status flags
    seo-content.ts             # SEO long-form content string/paragraphs
```

---

## Accessibility Requirements

| Element | Requirement |
|---|---|
| FAQ accordion | `role="region"`, `aria-labelledby` linking question to answer. Keyboard navigation: Enter/Space to toggle, arrow keys to move between items. |
| Footer links | All links must have discernible text. Social icons require `aria-label` (e.g., "Glamornate on Instagram"). |
| WhatsApp button | `aria-label="Chat with Glamornate on WhatsApp"`. Focus ring visible on keyboard focus. |
| Back to Top button | `aria-label="Scroll to top"`. Focus ring visible on keyboard focus. |
| CTA form input | Associated `<label>` (visually hidden if placeholder is used). `aria-required="true"`. Error state announced via `aria-live="polite"`. |
| Color contrast | All text on `brand-maroon-950` background must meet WCAG 2.1 AA (4.5:1 minimum). `brand-maroon-100` on `brand-maroon-950` meets this. `brand-maroon-400` on `brand-maroon-950` must be verified -- fallback to `brand-maroon-300` if insufficient. |
| Reduced motion | WhatsApp bounce animation and Back to Top fade respect `prefers-reduced-motion: reduce`. Disable animation, show elements immediately. |

---

## Performance Considerations

| Concern | Mitigation |
|---|---|
| Footer renders on every page | Render footer as a Server Component (RSC). No client-side JavaScript for static links. Only WhatsApp button and Back to Top button require `"use client"`. |
| SEO content block is large | Content is in the DOM for crawlers but hidden via CSS. No layout shift -- `max-height` is set explicitly. |
| FAQ structured data | JSON-LD script tag rendered server-side. No runtime JSON generation. |
| Hero image in CTA section | Use Next.js `<Image>` with `sizes` attribute, serve WebP via automatic optimization, lazy-load (not above the fold). |
| Scroll listener for Back to Top | Throttled via `requestAnimationFrame`, passive event listener. Minimal overhead. |
| WhatsApp button animation | CSS-only animation (no JS animation library). Runs on compositor thread (transform + opacity only). |

---

## Section Order on Page

For reference, these sections appear at the bottom of the homepage in the following order:

1. **Booking CTA Section** (brand-maroon-50 background)
2. **FAQ Section** (white background)
3. **Service Area / Cities** (brand-maroon-900 background)
4. **SEO Content Accordion** (section-bg / gray-100 background)
5. **Footer** (brand-maroon-950 background)
6. **Bottom Bar** (within footer, separated by horizontal rule)

Floating elements (always visible, fixed position):
- **WhatsApp Button** (bottom-right, z-50)
- **Back to Top Button** (bottom-right, offset from WhatsApp, z-40)
