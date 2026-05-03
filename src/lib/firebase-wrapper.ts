/**
 * Firebase Client Wrapper
 *
 * Loads Firebase services dynamically only on client side to avoid SWC compilation issues
 * with Firebase dependencies (undici private fields).
 */
import { logger } from '@/lib/logger';

type FirebaseModule = typeof import('@/lib/firebase-client');

interface FirebaseServices {
  spaService: FirebaseModule['spaService'];
  serviceCatalogService: FirebaseModule['serviceCatalogService'];
  authService: FirebaseModule['authService'];
  userService: FirebaseModule['userService'];
  bookingService: FirebaseModule['bookingService'];
  therapistService: FirebaseModule['therapistService'];
  reviewService: FirebaseModule['reviewService'];
  availabilityService: FirebaseModule['availabilityService'];
  // transactionService removed in Wave 1b (2026-05-02) — Stripe-only.
  payoutService: FirebaseModule['payoutService'];
  notificationService: FirebaseModule['notificationService'];
  voucherService: FirebaseModule['voucherService'];
  userVoucherService: FirebaseModule['userVoucherService'];
  walletService: FirebaseModule['walletService'];
  supportTicketService: FirebaseModule['supportTicketService'];
  analyticsService: FirebaseModule['analyticsService'];
  featureFlagService: FirebaseModule['featureFlagService'];
  auditLogService: FirebaseModule['auditLogService'];
}

let firebaseServices: FirebaseServices | null = null;

export async function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (typeof window === 'undefined') {
    throw new Error('Firebase services are client-side only');
  }

  if (firebaseServices) {
    return firebaseServices;
  }

  try {
    const firebaseModule = await import('@/lib/firebase-client');

    firebaseServices = {
      spaService: firebaseModule.spaService,
      serviceCatalogService: firebaseModule.serviceCatalogService,
      authService: firebaseModule.authService,
      userService: firebaseModule.userService,
      bookingService: firebaseModule.bookingService,
      therapistService: firebaseModule.therapistService,
      reviewService: firebaseModule.reviewService,
      availabilityService: firebaseModule.availabilityService,
      // transactionService removed in Wave 1b (2026-05-02) — Stripe-only.
      payoutService: firebaseModule.payoutService,
      notificationService: firebaseModule.notificationService,
      voucherService: firebaseModule.voucherService,
      userVoucherService: firebaseModule.userVoucherService,
      walletService: firebaseModule.walletService,
      supportTicketService: firebaseModule.supportTicketService,
      analyticsService: firebaseModule.analyticsService,
      featureFlagService: firebaseModule.featureFlagService,
      auditLogService: firebaseModule.auditLogService,
    };

    return firebaseServices;
  } catch (error) {
    logger.error('Error loading Firebase services', error, { component: 'firebase-wrapper' });
    return null;
  }
}

export async function initFirebase(): Promise<void> {
  try {
    const { initializeFirebaseApp } = await import('./firebase-config');
    await initializeFirebaseApp();
  } catch (error) {
    logger.warn('Firebase initialization skipped', { component: 'firebase-wrapper' }, { error: String(error) });
  }
}
