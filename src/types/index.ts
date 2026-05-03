/**
 * Glamornate - TypeScript Types
 * Based on Firestore database schema.
 *
 * Adoption status vs. `@glamornate/contracts` workspace package:
 *   - A (adopted): re-exported as `z.infer<typeof Schema>` from contracts.
 *   - B (deferred): shape differs between frontend and contracts; keep local
 *       definition with a TODO(A2-follow-up) marker. Phase 5 will reconcile.
 *   - C (local-only): no contract exists yet; keep local and log as candidate
 *       for contracts-package expansion.
 *
 * Reconciliation ledger: <internal-debug-notes>
 */

// --- Category A (adopted from @glamornate/contracts) ---
// Single source of truth for these types is the shared contracts package.
// Frontend used to re-declare them; they are now imported so any future
// change in contracts propagates automatically.
import type {
  SpaCategory,
  DiscountType,
  Location,
  Rating,
  RatingBreakdown,
  Geo,
  CartItemView,
  BookingPersistence,
  BookingRecordView,
  BookingRecordStatus,
  BookingAddress as ContractsBookingAddress,
  BookingLocation as ContractsBookingLocation,
  SpaFirestoreDoc,
  SpaPublicDto,
  SpaTier,
  SpaStatus,
  Amenity,
  Contact,
  OperatingHours,
  Commission,
  SpaPayoutConfig,
  Verification,
  Statistics,
  SEO,
} from '@glamornate/contracts';
export type {
  SpaCategory,
  DiscountType,
  Location,
  Rating,
  RatingBreakdown,
  Geo,
  BookingRecordStatus,
  SpaFirestoreDoc,
  SpaPublicDto,
  SpaTier,
  SpaStatus,
  Amenity,
  Contact,
  OperatingHours,
  Commission,
  SpaPayoutConfig,
  Verification,
  Statistics,
  SEO,
};

// CartItem, BookingRequest, BookingRecord all flow through @glamornate/contracts.
// Historic public names are preserved via aliases so existing call sites keep
// importing from `@/types` without edits. Note: the local `BookingStatus`
// declared further down is the broader 8-value Firestore `Booking.bookingStatus`
// enum — distinct from the BookingRecord.status 7-value union (which maps to
// contracts' BookingRecordStatus). Category B reconciliation keeps these
// separate to avoid narrowing the Firestore admin surface.
export type CartItem = CartItemView;
export type BookingRequest = BookingPersistence;
export type BookingRecord = BookingRecordView;
export type BookingLocation = ContractsBookingLocation;
export type BookingAddress = ContractsBookingAddress;

// Spa aliases to the canonical Firestore-doc shape from contracts
// (SpaFirestoreDoc carries all fields including internal commission + payout
// + verification + statistics + ownerId). Frontend admin, spa-dashboard, and
// partner surfaces read these fields directly. Consumer marketing pages that
// only need the public wire shape should switch to `SpaPublicDto` — Phase 5
// follow-up (carve marketing pages over to SpaPublicDto once they stop
// reading statistics/commission).
export type Spa = SpaFirestoreDoc;

// Generic utility type for documents with ID (Firestore pattern)
export type DocumentWithId<T> = T & { id: string };

// TODO(A2-follow-up): Category C — no contract yet for User/UserProfile/etc.
// The backend currently exposes user state via auth claims only; a full User
// schema in @glamornate/contracts would be a Phase-5 enabler for profile APIs.
// User Types
export type AuthProvider = 'email' | 'google' | 'phone';

export type UserRole = 'customer' | 'spa_owner' | 'spa_staff' | 'admin';

export interface UserProfile {
  displayName: string;
  email?: string;
  phone?: string;
  photo?: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
}

export interface UserPreferences {
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

export interface CustomerData {
  favorites: string[];
  history: string[];
}

export interface SpaData {
  spaId: string;
  permissions: string[];
  commissionRate: number;
}

export interface User {
  authProvider: AuthProvider;
  role: UserRole;
  profile: UserProfile;
  emailVerified: boolean;
  phoneVerified: boolean;
  preferences: UserPreferences;
  customerData?: CustomerData;
  spaData?: SpaData;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
}

// Spa sub-shapes (SpaTier, SpaStatus, Amenity, Contact, OperatingHours,
// Commission, SpaPayoutConfig, Verification, Statistics, SEO, Location,
// Rating) are adopted from @glamornate/contracts (see top of file). Local
// duplicates removed on Phase 2 Agent-01. The canonical Firestore-doc shape
// is `SpaFirestoreDoc`; the loose public wire shape is `SpaPublicDto` (strip
// internal fields via `spaFirestoreDocToPublicDto`).

// TODO(A2-follow-up): no contract exists for the canonical Service (distinct
// from contracts' HomeService, which models the home-page tile). Category C —
// candidate for contracts expansion.
// Service Types
export interface Service {
  name: string;
  slug: string;
  category: SpaCategory;
  description: string;
  benefits: string[];
  baseDuration: number;
  durationVariants: number[];
  basePrice: number;
  currency: string;
  recommendedFor: 'all' | 'men' | 'women';
  tags: string[];
  icon: string;
  images: string[];
  video?: string;
  addOns: Array<{
    name: string;
    price: number;
    duration: number;
  }>;
  isActive: boolean;
  ordering: number;
  searchIndex?: string;
}

export interface SpaService {
  compositeId: string;
  priceOverride?: number;
  durationOverride?: number;
  customName?: string;
  isActive: boolean;
}

// TODO(A2-follow-up): Category C — no contract yet for Therapist. Candidate
// for contracts-package expansion.
// Therapist Types
export interface Therapist {
  name: string;
  slug: string;
  displayName: string;
  photo: string;
  coverImage?: string;
  spaId: string;
  description: string;
  specialties: string[];
  certifications: Array<{
    name: string;
    issuer: string;
    issuedDate: string;
    expiryDate?: string;
    documentUrl: string;
  }>;
  yearsOfExperience: number;
  languages: string[];
  gender: 'male' | 'female' | 'other';
  rating: Rating;
  status: 'online' | 'offline';
  onLeave: boolean;
  availability: OperatingHours;
  commission: {
    percentage: number;
    flatRate: number;
  };
  statistics: {
    totalBookings: number;
    revenue: number;
    avgRating: number;
  };
  onLeaveFrom?: string;
  onLeaveTo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// BookingStatus below is the FIRESTORE `Booking.bookingStatus` enum — the
// post-Stripe-removal 6-value union (Wave 1b 2026-05-02). The NARROWER variant
// used on the view-model `BookingRecord.status` is reconciled through contracts
// as `BookingRecordStatus` (see top of file).
//
// History: pre-Wave-1b this was an 8-value union including `draft`,
// `payment_pending`, and `payment_failed` to support the Stripe online-payment
// flow. Stripe was removed in Wave 1b — bookings are now written directly with
// `bookingStatus: 'confirmed'` (pay-at-spa). `'no_show'` was added so spa staff
// can mark a customer who didn't arrive without firing the cancellation refund
// path. Category C (lives with `Booking`).
// Booking Types
export type BookingStatus =
  | 'confirmed'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Slot {
  date: string;
  start: string;
  end: string;
  duration: number;
}

export interface BookingService {
  serviceId: string;
  name: string;
  price: number;
  duration: number;
  quantity: number;
}

export interface Addon {
  name: string;
  price: number;
  duration: number;
}

export interface Pricing {
  services: number;
  addons: number;
  tax: number;
  discount: number;
  platformFee: number;
  total: number;
}

export interface StatusHistoryEntry {
  status: BookingStatus;
  from?: BookingStatus;
  to: BookingStatus;
  actor: 'customer' | 'spa' | 'admin' | 'system';
  actorId: string;
  timestamp: string;
  reason?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  notes?: string;
  preferences?: string[];
}

export interface Cancellation {
  reason: string;
  cancelledBy: 'customer' | 'spa' | 'admin';
  cancelledAt: string;
  refundedAmount: number;
}

export interface ReminderSent {
  at_24hr: boolean;
  at_2hr: boolean;
}

export type CreatedBy = 'customer' | 'spa' | 'admin';

export interface Booking {
  userId: string;
  spaId: string;
  therapistId?: string;
  serviceIds: string[];
  slot: Slot;
  services: BookingService[];
  addons?: Addon[];
  pricing: Pricing;
  /**
   * Human-friendly reference written server-side (`GLM-YYYYMMDD-XXX`).
   * Optional because legacy docs may pre-date the field.
   */
  bookingNumber?: string;
  bookingStatus: BookingStatus;
  statusHistory: StatusHistoryEntry[];
  customer: CustomerInfo;
  notes?: string;
  specialRequests?: string;
  cancellation?: Cancellation;
  reminderSent: ReminderSent;
  checkIn?: string;
  checkOut?: string;
  reviewId?: string;
  voucherId?: string;
  isActive: boolean;
  createdBy: CreatedBy;
  createdAt: string;
  updatedAt: string;
  scheduledAt: string;
}

// Availability Types
export interface SlotAvailability {
  start: string;
  end: string;
  available: boolean;
  bookingId?: string;
}

export interface Availability {
  compositeId: string;
  date: string;
  spaId: string;
  therapistId?: string;
  slots: SlotAvailability[];
  lastCalculatedAt: string;
  expiresAt: string;
}

// TODO(A2-follow-up): Category C — no contract yet for Review or its aspects.
// Review Types
export interface ReviewAspect {
  ambiance: number;
  service: number;
  therapist: number;
  hygiene: number;
}

export interface Review {
  userId: string;
  bookingId: string;
  spaId: string;
  therapistId?: string;
  rating: number;
  aspects: ReviewAspect;
  comment: string;
  title?: string;
  photos: string[];
  videos: string[];
  helpfulCount: number;
  reportedCount: number;
  moderation?: {
    status: 'pending' | 'approved' | 'rejected';
    moderatedBy: string;
  };
  reportedBy: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Transaction types removed in Wave 1b (2026-05-02) along with the rest of
// the Stripe online-payment flow. Pay-at-spa is now handled spa-side and
// generates no client-visible transaction documents. Re-introduce here if the
// product re-introduces an online-payment surface.

// Payout Types
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface Payout {
  spaId: string;
  userId: string;
  amount: {
    total: number;
    currency: string;
  };
  bookingIds: string[];
  period: {
    start: string;
    end: string;
  };
  status: PayoutStatus;
  paymentMethod: {
    type: 'bank';
    details: Record<string, unknown>;
  };
  processedAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// TODO(A2-follow-up): Category C — Notification + NotificationType have no
// contract yet. Push/in-app notification payloads are client-only today.
// Notification Types
export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'new_booking'
  | 'review_reminder'
  | 'review_request'
  | 'payout_processed'
  | 'spa_verified'
  | 'welcome'
  | 'general';

export interface Notification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  data: Record<string, unknown>;
  read: boolean;
  readAt?: string;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  sentAt: string;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
}

// Voucher Types
// TODO(A2-follow-up): no contract for Voucher. Category C — candidate for
// contracts expansion.
export type VoucherType = 'discount' | 'gift_card' | 'referral';

// DiscountType is adopted from @glamornate/contracts (see top of file).
// Contracts enum was expanded to `['percentage', 'flat', 'fixed_price']` in
// Phase 1 Agent-07 so the frontend voucher surface stays intact. Local
// duplicate removed — contracts enum is now the single source.

export interface Voucher {
  code: string;
  type: VoucherType;
  discountType: DiscountType;
  discountValue: number;
  usageLimit: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  applicableServices: string[];
  applicableSpas: string[];
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
}

export interface UserVoucher {
  compositeId: string;
  remainingUses: number;
  maxUses: number;
  usedAt: string[];
}

// Wallet Types
export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference?: string;
  createdAt: string;
}

export interface Wallet {
  userId: string;
  currency: string;
  balance: {
    current: number;
    credited: number;
    debited: number;
  };
  transactions: WalletTransaction[];
}

// Support Ticket Types
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface TicketMessage {
  id: string;
  senderId: string;
  senderType: 'customer' | 'spa' | 'admin';
  message: string;
  attachments: string[];
  timestamp: string;
}

export interface SupportTicket {
  userId?: string;
  spaId?: string;
  type: string;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  attachments: string[];
  bookingId?: string;
  assignedTo?: string;
  messages: TicketMessage[];
  resolution?: string;
  createdAt: string;
  closedAt?: string;
}

// Analytics Types
export type AnalyticsType = 'bookings' | 'revenue' | 'users' | 'spas' | 'reviews' | 'conversion';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Analytics {
  compositeId: string;
  type: AnalyticsType;
  period: AnalyticsPeriod;
  date: string;
  data: Record<string, unknown>;
}

// Flag Types
export interface FlagTargeting {
  users?: string[];
  roles?: UserRole[];
  percentage?: number;
}

export interface FeatureFlag {
  key: string;
  description: string;
  defaultValue: boolean;
  value: boolean;
  targeting: FlagTargeting;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Audit Log Types
export interface AuditLog {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ApiResponse is adopted from @glamornate/contracts (see top of file).
// The legacy object-error variant that previously lived here had no call
// sites (grep confirmed 0 imports of ApiResponse from @/types at the time of
// reconciliation). Consumers that need the envelope type import it directly
// from @glamornate/contracts — see `frontend/src/lib/api-client.ts`,
// `frontend/src/hooks/useHomeData.ts`, and `frontend/src/hooks/useApi.ts`.

// === UI-only types live in ./ui.ts ===
// Form view-models, filters, pagination params, and React store state shapes
// are not wire contracts — they stay in frontend and are re-exported here so
// `import { LoginForm } from '@/types'` keeps resolving.
export type {
  LoginForm,
  RegisterForm,
  BookingForm,
  PaginationParams,
  BookingFilters,
  AuthState,
  BookingState,
} from './ui';

// Convenience types for documents with Firestore ID
export type UserWithId = DocumentWithId<User>;
export type SpaWithId = DocumentWithId<Spa>;
export type ServiceWithId = DocumentWithId<Service>;
export type SpaServiceWithId = DocumentWithId<SpaService>;
export type TherapistWithId = DocumentWithId<Therapist>;
export type BookingWithId = DocumentWithId<Booking>;
export type ReviewWithId = DocumentWithId<Review>;
export type NotificationWithId = DocumentWithId<Notification>;

// === Cart Types ===
// CartItem is adopted from @glamornate/contracts as CartItemView (see top
// of file). View-model fields (categoryName, subcategory, price, originalPrice,
// discount, image) live on the contract now so the cart UI and backend wire
// shape share a single source of truth. Local duplicate removed.

// === Booking Types (view-model layer) ===
// BookingLocation + BookingAddress are adopted from @glamornate/contracts
// (see top of file). BookingLocation values are 'spa' | 'home' (matching
// Firestore docs); user-facing copy strings may still read "At Salon".

export interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
}

// BookingRequest is adopted from @glamornate/contracts as BookingPersistence
// (see top of file). Contracts carry the full persistence shape including
// userId + totalAmount + totalDuration plus the strict view-model
// CartItemView[] for services. Wire-validator shape lives on
// `BookingRequestSchema` in contracts for backend callers.

// BookingRecord is adopted from @glamornate/contracts as BookingRecordView
// (see top of file). Strict BookingRecordStatus union + bookingNumber +
// Firestore metadata. The broader 8-value Firestore `Booking.bookingStatus`
// enum (with `payment_failed` + `en_route`) remains local on the `Booking`
// Category-C type.

// === Chat Types ===
export type MessageSender = 'user' | 'bot' | 'admin';

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface ChatThread {
  id: string;
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'active' | 'closed';
}

// === Address Book Types ===
export type AddressLabel = 'home' | 'work' | 'other';

export interface SavedAddress {
  id: string;
  label: AddressLabel;
  name: string;
  phone: string;
  flatHouse: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
