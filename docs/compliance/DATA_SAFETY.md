# Google Play Console — Data Safety Declaration

**Generated:** 2026-04-20
**App:** Glamornate (`com.glamornate.app`)
**Owner:** Agent 3D (Play Store & Privacy Compliance)
**Source of truth:** This worksheet is derived from a code audit of the Firestore
schema (`src/types/index.ts`), the Firebase client layer
(`src/lib/firebase-client/index.ts`), and the Cloud Messaging / Location flows in
`src/lib/location-writer.ts` + hooks. It is NOT a generic template.

---

## 1. Data collection summary

| # | Data type | Play Store category | Collected | Shared | Optional | Ephemeral | Purpose | Storage |
|---|-----------|---------------------|-----------|--------|----------|-----------|---------|---------|
| 1 | Name | Personal Info | Yes | Yes (partner spa, after booking) | No | No | Account management, personalization, booking fulfilment | `users/{uid}/profile.displayName` |
| 2 | Email address | Personal Info | Yes | No | No | No | Account sign-in, transactional email, password reset | `users/{uid}/profile.email` + Firebase Auth |
| 3 | Phone number | Personal Info | Yes | Yes (partner spa, after booking) | Yes (if signed in via email/Google) | No | Booking SMS, OTP sign-in, partner confirmation calls | `users/{uid}/profile.phone` |
| 4 | Profile photo | Photos and videos | Yes | No | Yes | No | Personalization | Firebase Storage `users/{uid}/avatar/*` |
| 5 | User IDs | Personal Info | Yes | No | No | No | Account identification | Firebase Auth UID |
| 6 | Approximate location | Location | Yes (derived from pincode entry) | No | Yes | No | Show nearby spas on home screen | `users/{uid}/location.{city,pincode}` |
| 7 | Precise location | Location | Yes | No | Yes | Sometimes (geocoded once, then cached) | Address autocomplete for at-home bookings | `users/{uid}/addresses[].geo.{lat,lng}` |
| 8 | Street address | Personal Info | Yes | Yes (partner spa, after booking) | Yes | No | Service location for at-home bookings | `users/{uid}/addresses[]` |
| 9 | Purchase history | Financial info | Yes | No | No | No | Booking history, refund processing | `bookings/{id}` where `userId == uid` |
| 10 | Payment info (tokenised) | Financial info | No (handled by Stripe/Razorpay; we only store a reference) | No | N/A | N/A | Charge and refund bookings | Processor side only |
| 11 | Installed apps | App info and performance | No | No | N/A | N/A | Not collected | Not collected |
| 12 | App interactions (taps, screens) | App activity | Yes | No | No | Yes (90 days) | Improve product, debug crashes | Firebase Analytics |
| 13 | In-app search history | App activity | Yes | No | Yes (users can clear) | Yes | Show recent searches | Local device only (`glamornate-recent-searches`) |
| 14 | Crash logs | App info and performance | Yes | No | No | Yes (90 days) | Stability monitoring | Firebase Crashlytics (planned Phase 4) |
| 15 | Performance diagnostics | App info and performance | Yes | No | No | Yes (90 days) | Performance monitoring | Firebase Performance (planned Phase 4) |
| 16 | Device or other IDs | Device or other IDs | Yes | No | No | No | Deliver push notifications (FCM) | `users/{uid}/fcmTokens[]` |
| 17 | Reviews and ratings | User-generated content | Yes | Yes (public listing on spa page) | Yes | No | Public ratings, help other customers choose | `reviews/{id}` |
| 18 | Favourites | App activity | Yes | No | Yes | No | UX personalization | `users/{uid}/customerData.favorites` |
| 19 | Support messages | Messages (other in-app messages) | Yes | No | Yes | No | Customer support | `support_tickets/{id}` + messages subcollection |
| 20 | Wallet balance | Financial info | Yes | No | Yes (users may never use credits) | No | Store-credit tracking | `wallets/{uid}` |
| 21 | IP address | Device or other IDs | Yes (only on sensitive actions) | No | No | Yes (7-year audit retention for hashed log) | Security / fraud detection | `audit_logs/{id}` — hashed for deleted accounts |
| 22 | Audit metadata (hashed email/phone) | Personal Info | Yes (only on account deletion) | No | No | No | Dispute resolution, regulatory compliance | `audit_logs/{id}` |

---

## 2. Per-data-type Play Console answers

For each data type the Play Console asks four questions. Below is the copy-paste answer sheet.

### 2.1 Personal info

#### Name
- Collected? **Yes**
- Shared with third parties? **Yes** — the partner spa you book with.
- Is collection optional? **No (required at sign-up)**
- Purpose: **Account management, Personalization**
- Is the data processed ephemerally? **No**
- Is the user asked before collection? **Yes (during sign-up)**

#### Email address
- Collected? **Yes**
- Shared? **No**
- Optional? **No**
- Purpose: **Account management, Fraud prevention, security, and compliance**
- Processed ephemerally? **No**
- User asked? **Yes**

#### Phone number
- Collected? **Yes**
- Shared? **Yes** — the partner spa for booking confirmation.
- Optional? **Yes** (only required if signing up via phone OTP)
- Purpose: **Account management, Communications, Fraud prevention**
- Processed ephemerally? **No**
- User asked? **Yes**

#### User ID (Firebase UID)
- Collected? **Yes**
- Shared? **No**
- Optional? **No**
- Purpose: **Account management, Analytics, Fraud prevention**
- Processed ephemerally? **No**

#### Address
- Collected? **Yes**
- Shared? **Yes** — the partner spa for at-home bookings.
- Optional? **Yes** (only for at-home service bookings)
- Purpose: **Account management (saved addresses), App functionality (service delivery)**
- Processed ephemerally? **No**

### 2.2 Financial info

#### Purchase history
- Collected? **Yes**
- Shared? **No**
- Optional? **No**
- Purpose: **App functionality, Account management, Fraud prevention**
- Processed ephemerally? **No**

#### Payment info
- Collected? **No** — tokenised and stored by Stripe and Razorpay. We store only a reference.
- Shared? **No**
- Optional? **N/A**

### 2.3 Location

#### Approximate location (city / pincode)
- Collected? **Yes**
- Shared? **No**
- Optional? **Yes**
- Purpose: **App functionality (nearby spa discovery)**
- Processed ephemerally? **No**

#### Precise location (lat/lng)
- Collected? **Yes**
- Shared? **No**
- Optional? **Yes**
- Purpose: **App functionality (address autocomplete for at-home bookings)**
- Processed ephemerally? **Partly** — captured once per address, then cached on the user's saved address doc.

### 2.4 Photos and videos

#### Photos (profile photo, review photos)
- Collected? **Yes**
- Shared? **Yes** (review photos are public; profile photo is private)
- Optional? **Yes**
- Purpose: **Account management, App functionality (reviews)**
- Processed ephemerally? **No**

### 2.5 Messages

#### Support ticket messages
- Collected? **Yes**
- Shared? **No** (only with our support agents)
- Optional? **Yes** (only if you open a ticket)
- Purpose: **Customer support**
- Processed ephemerally? **No**

### 2.6 Device or other IDs

#### FCM registration token
- Collected? **Yes**
- Shared? **No**
- Optional? **Yes** (users can decline push notifications)
- Purpose: **App functionality (push notifications)**
- Processed ephemerally? **No**

#### IP address (audit only)
- Collected? **Yes (on sensitive actions only)**
- Shared? **No**
- Optional? **No**
- Purpose: **Fraud prevention, security, and compliance**
- Processed ephemerally? **Partly** — hashed and retained for 7 years in audit logs.

### 2.7 App activity

#### App interactions (screen views, taps)
- Collected? **Yes**
- Shared? **No**
- Optional? **No**
- Purpose: **Analytics, App functionality**
- Processed ephemerally? **Yes** (90-day retention in Firebase Analytics)

#### In-app search history
- Collected? **Yes (on device only)**
- Shared? **No**
- Optional? **Yes** (can be cleared from settings)
- Purpose: **Personalization**
- Processed ephemerally? **Yes**

#### Reviews
- Collected? **Yes**
- Shared? **Yes** (publicly displayed)
- Optional? **Yes**
- Purpose: **App functionality (help other customers choose)**

#### Favourites
- Collected? **Yes**
- Shared? **No**
- Optional? **Yes**
- Purpose: **Personalization**

### 2.8 App info and performance

#### Crash logs
- Collected? **Yes** (planned Phase 4)
- Shared? **No**
- Optional? **No**
- Purpose: **Analytics (stability)**
- Processed ephemerally? **Yes** (90-day retention)

#### Diagnostics (performance traces)
- Collected? **Yes** (planned Phase 4)
- Shared? **No**
- Optional? **No**
- Purpose: **Analytics (performance)**
- Processed ephemerally? **Yes** (90-day retention)

---

## 3. Security practices

| Question | Answer |
|----------|--------|
| Is data encrypted in transit? | **Yes** — TLS 1.2+ on all endpoints. Enforced by Firebase and Cloud Functions. |
| Is data encrypted at rest? | **Yes** — AES-256 or equivalent, managed by Google Firebase. |
| Do you follow Play Families Policy? | **Not applicable** — users must be 18+. |
| Have you committed to the MASA (Mobile Application Security Assessment)? | **No** — planned post-launch. |
| Can users request data deletion? | **Yes** — two paths: in-app (Account → Delete Account, 2 taps) and email `support@glamornate.example` with subject "Account Deletion". Public URL: `/data-deletion`. |
| Is your data collection and processing transparent? | **Yes** — disclosed in `/privacy` and `/data-deletion`. |
| Has your app undergone an independent security review? | **No** — marked as "pending" with counsel. TODO before GA. |

---

## 4. Cross-checks against code

- The Firestore types in `src/types/index.ts` (User, Booking, Review, Notification,
  Voucher, Wallet, SupportTicket) were enumerated one-by-one above.
- FCM tokens are stored on the user document (see `src/lib/firebase-client/index.ts`
  and `src/hooks/useNotifications.ts`).
- Location persistence lives in `src/lib/location-writer.ts`
  (`users/{uid}/location.*` and `users/{uid}/addresses[].geo`).
- Payment data is never persisted; processor tokens only (see
  `src/types/index.ts` `PaymentDetails` + `src/lib/payments/`).
- Audit log shape is in `src/types/index.ts` (`AuditLog` interface).

## 5. Known gaps / TODOs for user

- **Confirm the support email.** `support@glamornate.example` is a placeholder.
  Replace everywhere before submitting the listing.
- **Confirm Data Protection Officer contact.** Not listed on the privacy page.
- **Confirm whether Firebase Analytics is wired up.** If Phase 4 enables Firebase
  Analytics / Crashlytics / Performance Monitoring, the "App activity" and
  "App info and performance" rows become definite "Yes"; until then they are
  "Yes (planned)". Update this doc when Phase 4 lands.
- **Independent security review.** The current answer is "No". If an external
  pentest is planned before launch, update the Security practices table.
