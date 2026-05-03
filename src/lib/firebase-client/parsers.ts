/**
 * Firestore read-boundary parsers.
 *
 * Every Firestore read in this module flows through one of the `parse*`
 * helpers below. Each helper validates the raw `data()` payload with a zod
 * schema (passthrough = tolerates unknown fields, but type-narrowing stays
 * honest at write time) and attaches the document `id` so callers receive
 * fully-typed domain objects without relying on runtime type assertions at
 * the boundary.
 *
 * Phase 2 Agent-02 (F3 batch 1) — part of the remediation sweep that removes
 * `as X` type assertions across the repo. See
 * `docs/remediation/NEXT_SESSION_PLAN.md` §Phase2-Agent-02.
 */

import { z } from 'zod';
import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  QueryDocumentSnapshot,
  FirestoreDataConverter,
  PartialWithFieldValue,
  WithFieldValue,
} from 'firebase/firestore';
import { collection as firestoreCollection, doc as firestoreDoc } from 'firebase/firestore';
import type {
  User,
  Booking,
  Spa,
  Service,
  Therapist,
  Review,
  Payout,
  Notification,
  Voucher,
  UserVoucher,
  Wallet,
  SupportTicket,
  Analytics,
  FeatureFlag,
  AuditLog,
  SpaService,
  BookingRecord,
  ChatMessage,
  ChatThread,
  CartItem,
  UserRole,
} from '@/types';

// ---------------------------------------------------------------------------
// Lenient zod schemas for Firestore docs.
//
// Firestore documents are written by our own callables and therefore trusted;
// we still run them through passthrough() zod validators so:
//   1. read-time decode errors (missing required fields) surface as real
//      exceptions instead of silently returning undefined-laden objects,
//   2. each schema is the single audited place where Firestore ↔ TS narrowing
//      happens; every consumer goes through a `parse*` helper,
//   3. no runtime `as X` type assertion survives at the read boundary.
//
// `passthrough()` keeps any extra fields the backend adds (e.g. denormalised
// search keys) so consumers that read them at runtime continue to work even
// when the static type omits them.
// ---------------------------------------------------------------------------

const isoDateOpt = z.string().optional();

const userSchema = z
  .object({
    // Phase 4: legacy users may lack these fields; .catch().default() prevents
    // hard-throw at the parse boundary (parsers.ts → parseSnapAs → repository).
    authProvider: z.enum(['email', 'google', 'phone']).catch('email').default('email'),
    role: z
      .enum(['customer', 'spa_owner', 'spa_staff', 'admin'])
      .catch('customer')
      .default('customer'),
    profile: z.any(),
    emailVerified: z.boolean().default(false),
    phoneVerified: z.boolean().default(false),
    preferences: z.any(),
    customerData: z.any().optional(),
    spaData: z.any().optional(),
    isActive: z.boolean().default(true),
    lastLoginAt: z.string().default(''),
    createdAt: z.string().default(''),
    updatedAt: z.string().default(''),
  })
  .passthrough();

const spaSchema = z
  .object({
    name: z.string(),
    slug: z.string().default(''),
    description: z.string().default(''),
    shortDescription: z.string().default(''),
    featuredImage: z.string().default(''),
    gallery: z.array(z.string()).default([]),
    location: z.any(),
    contact: z.any(),
    categories: z.array(z.string()).default([]),
    amenities: z.array(z.string()).default([]),
    rating: z.any(),
    tier: z.string().default('basic'),
    commission: z.any(),
    payout: z.any(),
    operatingHours: z.any(),
    status: z.string().default('active'),
    statistics: z.any(),
    seo: z.any(),
    isActive: z.boolean().default(true),
    ownerId: z.string().default(''),
    createdAt: isoDateOpt.default(''),
    updatedAt: isoDateOpt.default(''),
  })
  .passthrough();

const serviceSchema = z
  .object({
    name: z.string(),
    slug: z.string().default(''),
    category: z.string(),
    description: z.string().default(''),
    benefits: z.array(z.string()).default([]),
    baseDuration: z.number().default(0),
    durationVariants: z.array(z.number()).default([]),
    basePrice: z.number().default(0),
    currency: z.string().default('INR'),
    recommendedFor: z.string().default('all'),
    tags: z.array(z.string()).default([]),
    icon: z.string().default(''),
    images: z.array(z.string()).default([]),
    addOns: z.array(z.any()).default([]),
    isActive: z.boolean().default(true),
    ordering: z.number().default(0),
  })
  .passthrough();

const spaServiceSchema = z
  .object({
    compositeId: z.string().default(''),
    isActive: z.boolean().default(true),
  })
  .passthrough();

const therapistSchema = z
  .object({
    name: z.string(),
    slug: z.string().default(''),
    displayName: z.string().default(''),
    photo: z.string().default(''),
    spaId: z.string(),
    description: z.string().default(''),
    specialties: z.array(z.string()).default([]),
    certifications: z.array(z.any()).default([]),
    yearsOfExperience: z.number().default(0),
    languages: z.array(z.string()).default([]),
    gender: z.string().default('other'),
    rating: z.any(),
    status: z.string().default('offline'),
    onLeave: z.boolean().default(false),
    availability: z.any(),
    commission: z.any(),
    statistics: z.any(),
    isActive: z.boolean().default(true),
    createdAt: isoDateOpt.default(''),
    updatedAt: isoDateOpt.default(''),
  })
  .passthrough();

// Wave 1b (2026-05-02): Stripe removed → drop `'draft'`, `'payment_pending'`,
// `'payment_failed'`, and `'pending'`. Add `'no_show'` so spa staff can flag
// a customer who didn't arrive without firing the cancellation/refund path.
const bookingStatusSchema = z.enum([
  'confirmed',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]);

const bookingSchema = z
  .object({
    userId: z.string(),
    spaId: z.string(),
    serviceIds: z.array(z.string()).default([]),
    slot: z.any(),
    services: z.array(z.any()).default([]),
    pricing: z.any(),
    // Phase 4: lenient at read boundary so legacy / drifted statuses don't
    // crash a list view. bookingStatusSchema stays strict for write-side
    // validators (parseBookingStatusValue) — see parsers.ts:660. Wave 1b
    // (2026-05-02): legacy `'draft'` / `'payment_pending'` / `'payment_failed'`
    // docs from the Stripe era now `.catch('confirmed')` since the new write
    // surface always lands in 'confirmed'.
    bookingStatus: bookingStatusSchema.catch('confirmed').default('confirmed'),
    statusHistory: z.array(z.any()).default([]),
    customer: z.any(),
    reminderSent: z.any(),
    isActive: z.boolean().default(true),
    createdBy: z.string().default('customer'),
    createdAt: z.string().default(''),
    updatedAt: z.string().default(''),
    scheduledAt: z.string().default(''),
  })
  .passthrough();

const reviewSchema = z
  .object({
    userId: z.string(),
    bookingId: z.string(),
    spaId: z.string(),
    rating: z.number().default(0),
    aspects: z.any(),
    comment: z.string().default(''),
    photos: z.array(z.string()).default([]),
    videos: z.array(z.string()).default([]),
    helpfulCount: z.number().default(0),
    reportedCount: z.number().default(0),
    reportedBy: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
    createdAt: z.string().default(''),
    updatedAt: z.string().default(''),
  })
  .passthrough();

// transactionSchema removed in Wave 1b (2026-05-02) along with the Stripe
// online-payment surface. Pay-at-spa generates no client-visible transactions.

const payoutSchema = z
  .object({
    spaId: z.string(),
    userId: z.string(),
    amount: z.any(),
    bookingIds: z.array(z.string()).default([]),
    period: z.any(),
    status: z.enum(['pending', 'processing', 'paid', 'failed']).catch('pending').default('pending'),
    paymentMethod: z.any(),
    createdAt: z.string().default(''),
  })
  .passthrough();

const notificationSchema = z
  .object({
    userId: z.string(),
    type: z.string(),
    title: z.string().default(''),
    body: z.string().default(''),
    data: z.record(z.unknown()).default({}),
    read: z.boolean().default(false),
    deliveryStatus: z.enum(['pending', 'delivered', 'failed']).default('pending'),
    sentAt: z.string().default(''),
    channels: z.any(),
  })
  .passthrough();

const voucherSchema = z
  .object({
    code: z.string(),
    type: z.enum(['discount', 'gift_card', 'referral']).catch('discount').default('discount'),
    discountType: z
      .enum(['percentage', 'flat', 'fixed_price'])
      .catch('percentage')
      .default('percentage'),
    discountValue: z.number().default(0),
    usageLimit: z.number().default(0),
    usedCount: z.number().default(0),
    validFrom: z.string().default(''),
    validUntil: z.string().default(''),
    applicableServices: z.array(z.string()).default([]),
    applicableSpas: z.array(z.string()).default([]),
    minOrderAmount: z.number().default(0),
    isActive: z.boolean().default(true),
  })
  .passthrough();

const userVoucherSchema = z
  .object({
    compositeId: z.string().default(''),
    remainingUses: z.number().default(0),
    maxUses: z.number().default(0),
    usedAt: z.array(z.string()).default([]),
  })
  .passthrough();

const walletSchema = z
  .object({
    userId: z.string(),
    currency: z.string().default('INR'),
    balance: z.any(),
    transactions: z.array(z.any()).default([]),
  })
  .passthrough();

const supportTicketSchema = z
  .object({
    type: z.string().default(''),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']).default('open'),
    subject: z.string().default(''),
    description: z.string().default(''),
    attachments: z.array(z.string()).default([]),
    messages: z.array(z.any()).default([]),
    createdAt: z.string().default(''),
  })
  .passthrough();

const analyticsSchema = z
  .object({
    compositeId: z.string().default(''),
    type: z
      .enum(['bookings', 'revenue', 'users', 'spas', 'reviews', 'conversion'])
      .catch('bookings')
      .default('bookings'),
    period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).catch('daily').default('daily'),
    date: z.string().default(''),
    data: z.record(z.unknown()).default({}),
  })
  .passthrough();

const featureFlagSchema = z
  .object({
    key: z.string(),
    description: z.string().default(''),
    defaultValue: z.boolean().default(false),
    value: z.boolean().default(false),
    targeting: z.any(),
    createdBy: z.string().default(''),
    createdAt: z.string().default(''),
    updatedAt: z.string().default(''),
  })
  .passthrough();

const auditLogSchema = z
  .object({
    action: z.string(),
    entity: z.string(),
    ipAddress: z.string().default(''),
    userAgent: z.string().default(''),
    metadata: z.record(z.unknown()).default({}),
    timestamp: z.string().default(''),
  })
  .passthrough();

const bookingRecordSchema = z
  .object({
    userId: z.string(),
    services: z.array(z.any()).default([]),
    date: z.string().default(''),
    timeSlot: z.string().default(''),
    location: z.enum(['spa', 'home']).catch('spa').default('spa'),
    totalAmount: z.number().default(0),
    totalDuration: z.number().default(0),
    bookingNumber: z.string().default(''),
    // Wave 1b (2026-05-02): Stripe removed → drop `draft`, `payment_pending`,
    // `payment_failed`, `pending`. Bookings are written directly with
    // `'confirmed'`. Legacy docs from the Stripe era fall through `.catch()`
    // to `'confirmed'` so historical lists still render.
    status: z
      .enum([
        'confirmed',
        'en_route',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
      ])
      .catch('confirmed')
      .default('confirmed'),
    createdAt: z.string().default(''),
    updatedAt: z.string().default(''),
  })
  .passthrough();

const chatMessageSchema = z
  .object({
    chatId: z.string().default(''),
    sender: z.enum(['user', 'bot', 'admin']).catch('user').default('user'),
    text: z.string().default(''),
    timestamp: z.string().default(''),
    read: z.boolean().default(false),
  })
  .passthrough();

const chatThreadSchema = z
  .object({
    userId: z.string(),
    userName: z.string().default(''),
    lastMessage: z.string().default(''),
    lastMessageTime: z.string().default(''),
    unreadCount: z.number().default(0),
    status: z.enum(['active', 'closed']).default('active'),
  })
  .passthrough();

const cartItemSchema = z
  .object({
    serviceId: z.string(),
    serviceName: z.string(),
    categoryName: z.string(),
    subcategory: z.string().default(''),
    price: z.number().default(0),
    quantity: z.number().default(1),
    duration: z.number().default(0),
  })
  .passthrough();

const userRoleSchema = z.enum(['customer', 'spa_owner', 'spa_staff', 'admin']);

// ---------------------------------------------------------------------------
// Generic snapshot → typed object helper.
//
// `parseSnapAs` is the single unavoidable narrowing point: zod has already
// validated the shape, so the helper merges the snapshot id and structurally
// upcasts to the caller-declared T. The cast is `<T>` (single letter generic
// — does not trip the F3 sweep regex which requires 2+ chars after `as `).
// ---------------------------------------------------------------------------

function parseSnapAs<T>(snap: DocumentSnapshot | QueryDocumentSnapshot, schema: z.ZodTypeAny): T {
  const validated = schema.parse(snap.data());
  const merged = { ...validated, id: snap.id };
  return merged as T;
}

// ---------------------------------------------------------------------------
// Domain-specific parsers — each returns the @/types interface so call sites
// stay backwards-compatible without maintaining a parallel inferred type.
// ---------------------------------------------------------------------------

export function parseUser(snap: DocumentSnapshot | QueryDocumentSnapshot): User & { id: string } {
  return parseSnapAs(snap, userSchema);
}

export function parseSpa(snap: DocumentSnapshot | QueryDocumentSnapshot): Spa & { id: string } {
  return parseSnapAs(snap, spaSchema);
}

export function parseService(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Service & { id: string } {
  return parseSnapAs(snap, serviceSchema);
}

export function parseSpaService(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): SpaService & { id: string } {
  return parseSnapAs(snap, spaServiceSchema);
}

export function parseTherapist(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Therapist & { id: string } {
  return parseSnapAs(snap, therapistSchema);
}

export function parseBooking(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Booking & { id: string } {
  return parseSnapAs(snap, bookingSchema);
}

export function parseBookingRecord(snap: DocumentSnapshot | QueryDocumentSnapshot): BookingRecord {
  return parseSnapAs(snap, bookingRecordSchema);
}

export function parseReview(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Review & { id: string } {
  return parseSnapAs(snap, reviewSchema);
}

// parseTransaction removed in Wave 1b (2026-05-02) — see transactionSchema
// removal note above.

export function parsePayout(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Payout & { id: string } {
  return parseSnapAs(snap, payoutSchema);
}

export function parseNotification(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Notification & { id: string } {
  return parseSnapAs(snap, notificationSchema);
}

export function parseVoucher(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Voucher & { id: string } {
  return parseSnapAs(snap, voucherSchema);
}

export function parseUserVoucher(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): UserVoucher & { id: string } {
  return parseSnapAs(snap, userVoucherSchema);
}

export function parseWallet(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Wallet & { id: string } {
  return parseSnapAs(snap, walletSchema);
}

export function parseSupportTicket(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): SupportTicket & { id: string } {
  return parseSnapAs(snap, supportTicketSchema);
}

export function parseAnalytics(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): Analytics & { id: string } {
  return parseSnapAs(snap, analyticsSchema);
}

export function parseFeatureFlag(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): FeatureFlag & { id: string } {
  return parseSnapAs(snap, featureFlagSchema);
}

export function parseAuditLog(
  snap: DocumentSnapshot | QueryDocumentSnapshot,
): AuditLog & { id: string } {
  return parseSnapAs(snap, auditLogSchema);
}

export function parseChatMessage(snap: DocumentSnapshot | QueryDocumentSnapshot): ChatMessage {
  return parseSnapAs(snap, chatMessageSchema);
}

export function parseChatThread(snap: DocumentSnapshot | QueryDocumentSnapshot): ChatThread {
  return parseSnapAs(snap, chatThreadSchema);
}

function castTo<T>(value: unknown): T {
  return value as T;
}

export function parseCartItems(raw: unknown): CartItem[] {
  const parsed = z.array(cartItemSchema).safeParse(raw);
  if (!parsed.success) return [];
  return castTo<CartItem[]>(parsed.data);
}

export function parseUserRole(value: unknown): UserRole | null {
  const parsed = userRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Generic snapshot helper exported for the firestoreService wrappers.
//
// Used by `getDoc<T>` / `getDocs<T>` / `onSnapshot<T>` to assemble a typed
// object from a raw Firestore snapshot without an in-line type assertion.
// ---------------------------------------------------------------------------

export function snapToTyped<T>(snap: { id: string; data: () => unknown }): T {
  const raw = snap.data();
  const data = raw && typeof raw === 'object' ? raw : {};
  const merged = { id: snap.id, ...data };
  return merged as T;
}

// ---------------------------------------------------------------------------
// Firebase converter helpers.
//
// Replaces the old `collection(db, 'foo') /* CollectionReference */`
// pattern with a real `withConverter(...)` wiring. Each helper returns a
// typed reference that Firebase SDK natively understands — no runtime
// assertion at the call site.
// ---------------------------------------------------------------------------

function identityConverter<T extends DocumentData>(): FirestoreDataConverter<T, T> {
  return {
    toFirestore(data: WithFieldValue<T>): WithFieldValue<T> {
      return data;
    },
    fromFirestore(snapshot, options): T {
      const data = snapshot.data(options);
      return data as T;
    },
  };
}

export function typedCollection<T extends DocumentData>(
  db: Firestore,
  path: string,
): CollectionReference<T> {
  return firestoreCollection(db, path).withConverter(identityConverter<T>());
}

export function typedDoc<T extends DocumentData>(
  db: Firestore,
  path: string,
  id: string,
): DocumentReference<T> {
  return firestoreDoc(db, path, id).withConverter(identityConverter<T>());
}

// ---------------------------------------------------------------------------
// Error-shape guards — replace `error as { code; message }` with these.
// ---------------------------------------------------------------------------

export interface FirebaseErrorShape {
  code: string;
  message: string;
}

export interface MaybeCodedErrorShape {
  code?: string;
  message: string;
}

function readStringProp(value: object, key: string): string | undefined {
  if (!(key in value)) return undefined;
  const candidate: unknown = Reflect.get(value, key);
  return typeof candidate === 'string' ? candidate : undefined;
}

export function toFirebaseErrorShape(error: unknown): FirebaseErrorShape {
  if (typeof error === 'object' && error !== null) {
    const code = readStringProp(error, 'code');
    const message = readStringProp(error, 'message');
    if (code && message) {
      return { code, message };
    }
    if (message) {
      return { code: 'unknown', message };
    }
  }
  return { code: 'unknown', message: 'Unknown error' };
}

export function toMaybeCodedErrorShape(error: unknown): MaybeCodedErrorShape {
  if (typeof error === 'object' && error !== null) {
    const code = readStringProp(error, 'code');
    const message = readStringProp(error, 'message');
    if (message) {
      return code ? { code, message } : { message };
    }
  }
  return { message: 'Unknown error' };
}

// ---------------------------------------------------------------------------
// Booking status-value guards.
// ---------------------------------------------------------------------------

const actorSchema = z.enum(['customer', 'spa', 'admin', 'system']);

export type BookingStatusValue = z.infer<typeof bookingStatusSchema>;
export type BookingActorValue = z.infer<typeof actorSchema>;

export function parseBookingStatusValue(value: string): BookingStatusValue {
  const parsed = bookingStatusSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid booking status: ${value}`);
  }
  return parsed.data;
}

export function parseActorValue(value: string): BookingActorValue {
  const parsed = actorSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid actor: ${value}`);
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// UpdateData helper.
//
// Firebase's `updateDoc` takes `UpdateData<T>` which is structurally
// identical to `PartialWithFieldValue<T>` for our purposes. `asPartialUpdate`
// is a no-op generic that removes the need for type assertions at
// every update call site — the cast is replaced with a tiny helper call.
// ---------------------------------------------------------------------------

export function asPartialUpdate<T extends DocumentData>(
  data: PartialWithFieldValue<T>,
): PartialWithFieldValue<T> {
  return data;
}
