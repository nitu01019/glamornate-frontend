# Google Play Store Listing Checklist — Glamornate

**Generated:** 2026-04-20
**App ID:** `com.glamornate.app`
**Owner:** Agent 3D

This file is the source of truth for every Play Console listing field. Fill in
each value before submitting the release. Values marked `TODO` must be confirmed
by the founder.

---

## 1. Core identification

| Field | Value | Notes |
|-------|-------|-------|
| Application name | Glamornate | Matches `capacitor.config.ts` (`appName`). |
| Application ID | `com.glamornate.app` | Matches `capacitor.config.ts` (`appId`). |
| Default language | English (United States) (`en-US`) | |
| Default country | India | |
| Category | **Beauty** | Fallback: **Health & Fitness** if Beauty is unavailable. |
| Tags | Beauty, Spa, Wellness, Massage, Facial | Max 5. |

## 2. Short and long descriptions

### Short description (80 character max)

```
Book luxury spas, salons, and at-home beauty services near you.
```
(59 characters)

### Full description (4000 character max — draft below)

```
Glamornate brings premium spa, salon, and wellness bookings to your
fingertips. Whether you want a relaxing massage after a long week, a bridal
glow facial before the big day, or a quick threading touch-up between
meetings, we connect you with verified beauty partners who come to you or
welcome you in.

WHY GLAMORNATE

- Curated partner spas: Every spa on Glamornate is verified by our team. You
  see real, recent reviews from customers who actually booked, not generic
  star ratings.
- At-home and in-salon: Book a service at a partner spa, or invite a vetted
  therapist to your home. Your choice, same trusted provider.
- Transparent prices: The price you see is the price you pay. No surprise
  fees at checkout, no up-selling at the door.
- Flexible timing: Pick from slots that match your schedule. See real-time
  availability before you commit.
- Easy cancellations: Cancel more than 24 hours before your slot and get a
  full refund back to your card or wallet.

WHAT YOU CAN BOOK

Glamornate covers the full range of beauty and wellness services:

- Facials: Gold, Fruit, Hydra, Korean Glass, Wine, Herbal, Anti-tan, Glow,
  Bridal
- Massages: Swedish, Deep Tissue, Thai, Ayurvedic, Aromatherapy, Hot Stone,
  Sports, Pregnancy
- Waxing and threading: Honey wax, fruit wax, sugar wax, eyebrows,
  sidelocks, full-body
- Body polishing and scrubs: Detan, mud mask, salt scrub
- Manicures and pedicures: Classic, spa, gel, shellac, nail art
- Hair services: Cut, colour, smoothing, keratin, rebonding, spa treatment
- Bleach and clean-up: Diamond, pearl, gold, herbal bleach
- Bridal packages: Pre-bridal, wedding day, honeymoon glow

NEARBY SPAS MADE SIMPLE

- Share your location and Glamornate shows you verified spas nearby, sorted
  by rating, distance, and price.
- Save multiple addresses for home, office, or travel.
- Read verified reviews with ratings for ambiance, service, hygiene, and
  therapist skill.

SAFE AND SECURE PAYMENTS

- Pay with UPI, credit or debit card, net banking, or Glamour Wallet
  credits. Stripe and Razorpay handle the payment. We never see or store
  your full card number.
- Automatic refunds for qualifying cancellations, typically within 5 to 7
  business days.
- Glamour Wallet stores your credits from referrals and cancellations for
  future bookings.

ELITE MEMBERSHIP

Join Elite for a small yearly fee and save more than three times the
membership cost on every booking. Includes priority slots, exclusive
therapists, and concierge support.

REFER AND EARN

Invite friends using your referral code. When they complete a booking, you
earn Glamour Coins that apply to your next service.

ACCOUNT AND PRIVACY

- Create your account with email, phone, or Google.
- You own your data. Delete your account any time: Account tab to Delete
  Account, two taps. Alternatively, email support with subject "Account
  Deletion" and we confirm within 30 days.
- Our privacy policy explains every data field we collect and why, in plain
  English. We never sell data. We never show third-party adverts inside the
  app.

WHO GLAMORNATE IS FOR

- Busy professionals who need salon-quality service without the travel time.
- Brides and grooms planning their wedding glow routine.
- Travellers visiting a new city who want a trusted spa.
- Anyone who enjoys being pampered and values transparency about prices and
  service.

SUPPORT

Need help? Tap Help in the app or email us. We respond quickly, in English
or Hindi, and we follow up until you are happy.

Glamornate is built in India, for India. Welcome to your new beauty routine.
```

Character count target: **3000+** (actual draft above is approximately 3650 characters).

## 3. Graphics and media (paths)

| Asset | Size (px) | Path |
|-------|-----------|------|
| App icon | 512 x 512 | `public/icons/icon-512.png` (TODO: confirm exists) |
| Feature graphic | 1024 x 500 | `public/play-store/feature-graphic.png` (TODO: produce) |
| Phone screenshot 1 | 1080 x 1920 (min) | `public/play-store/screens/phone-01-home.png` (TODO) |
| Phone screenshot 2 | 1080 x 1920 | `public/play-store/screens/phone-02-categories.png` (TODO) |
| Phone screenshot 3 | 1080 x 1920 | `public/play-store/screens/phone-03-spa-detail.png` (TODO) |
| Phone screenshot 4 | 1080 x 1920 | `public/play-store/screens/phone-04-booking.png` (TODO) |
| Phone screenshot 5 | 1080 x 1920 | `public/play-store/screens/phone-05-account.png` (TODO) |
| Phone screenshot 6 | 1080 x 1920 | `public/play-store/screens/phone-06-bookings.png` (TODO) |
| Phone screenshot 7 | 1080 x 1920 | `public/play-store/screens/phone-07-delete.png` (TODO — required for reviewer) |
| Promo video (optional) | YouTube URL | TODO |

Screenshot count minimum: 2 phone screenshots. Recommended: 8.

## 4. Contact and policy URLs

| Field | Value |
|-------|-------|
| Developer name | TODO: confirm legal entity (Glamornate Technologies Pvt. Ltd.) |
| Developer website | https://glamornate.example (TODO: confirm domain) |
| Developer email | TODO: confirm (`support@glamornate.example` placeholder) |
| Phone (optional) | TODO |
| Physical address | TODO (required for India publishing) |
| Privacy policy URL | `https://glamornate.example/privacy` |
| Account deletion URL | `https://glamornate.example/data-deletion` |

## 5. Content rating (IARC) answers

Play asks a questionnaire. Expected answers for a beauty-booking app:

| Question | Answer |
|----------|--------|
| Does the app contain violence? | **No** |
| Does the app contain sexual content? | **No** |
| Does the app contain profanity? | **No** |
| Does the app contain controlled substances? | **No** |
| Does the app contain gambling? | **No** |
| Does the app contain user-generated content? | **Yes** (reviews and photos, moderated before display) |
| Does the app share location with other users? | **No** |
| Does the app allow direct messaging? | **Yes** — only with support agents, not peer to peer |
| Does the app collect personally identifying information? | **Yes** — see Data Safety form |

Expected rating: **Everyone 10+ / PEGI 3**. Actual rating determined by IARC.

## 6. Target age and audience

- Target audience: **Adults (18+)**.
- The app is not designed for children; no child-directed features.

## 7. Ads

- Contains ads? **No**.
- Uses in-app purchases? **Yes** — Elite Membership subscription (Phase 4 deliverable).

## 8. Data Safety form

See `DATA_SAFETY.md` — copy the answers into the Play Console Data Safety
workflow field by field.

## 9. Release tracks and rollout

1. **Internal testing:** 1 to 100 internal testers. Use the signed debug APK on
   Desktop as source.
2. **Closed testing:** Private beta group by email. Run for 7 days minimum.
3. **Open testing:** Optional. Recommended for stress-testing.
4. **Production:** Staged rollout 10% -> 50% -> 100% over 7 days.

## 10. Pre-submission checklist

- [ ] Privacy policy URL is reachable and renders without login.
- [ ] Data Deletion URL is reachable and renders without login.
- [ ] In-app delete account path is 2 taps from app entry for signed-in
      users (verified in `REACHABILITY_AUDIT.md`).
- [ ] Data Safety form answers copied from `DATA_SAFETY.md`.
- [ ] App bundle signed with the upload key.
- [ ] Content rating questionnaire complete.
- [ ] All screenshots present and compressed.
- [ ] Contact email confirmed and monitored.
- [ ] Return-report TODOs resolved.
