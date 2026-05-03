/**
 * Firestore helpers for bookings (BookingRequest / BookingRecord).
 *
 * Every public function guards on isFirebaseConfigured() so the app
 * works in demo mode without real Firebase credentials.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { getFirebaseFirestore } from './index';
import { parseBookingRecord } from './parsers';
import type { BookingRequest, BookingRecord } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a booking number in the format "GLM-YYYYMMDD-XXX"
 * where XXX is a random 3-digit number (zero-padded).
 */
function generateBookingNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `GLM-${yyyy}${mm}${dd}-${random}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new booking from a BookingRequest.
 * Generates bookingNumber and persists to Firestore with status 'confirmed'.
 *
 * Wave 1b (2026-05-02): Stripe online-payment surface removed. Bookings now
 * lock the slot immediately as 'confirmed' (pay-at-spa). The previous 'draft'
 * → Stripe webhook → 'confirmed' two-step is gone, so this client-side helper
 * is safe to write 'confirmed' directly. Server-side `createBookingDraft`
 * Cloud Function (called from `useCreateBooking`) is the canonical write path
 * for production traffic; this helper exists for demo-mode and direct test
 * fixtures.
 */
export async function createBooking(
  booking: BookingRequest
): Promise<BookingRecord> {
  if (!isFirebaseConfigured()) {
    const now = new Date().toISOString();
    return {
      ...booking,
      id: `demo-${Date.now()}`,
      bookingNumber: generateBookingNumber(),
      // Pay-at-spa: confirmed immediately (no online-payment gate).
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    };
  }

  const db = getFirebaseFirestore();
  const colRef = collection(db, 'bookings');
  const docRef = doc(colRef);
  const now = new Date().toISOString();

  const record: BookingRecord = {
    ...booking,
    id: docRef.id,
    bookingNumber: generateBookingNumber(),
    // Pay-at-spa: confirmed immediately (no online-payment gate).
    status: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, record);
  return record;
}

/**
 * Fetch all bookings for a given user, newest first.
 */
export async function getUserBookings(
  userId: string
): Promise<BookingRecord[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const db = getFirebaseFirestore();
  const q = query(
    collection(db, 'bookings'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => parseBookingRecord(d));
}

/**
 * Fetch a single booking by its Firestore document ID.
 */
export async function getBookingById(
  id: string
): Promise<BookingRecord | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const db = getFirebaseFirestore();
  const docRef = doc(db, 'bookings', id);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return null;
  }

  return parseBookingRecord(snap);
}

/**
 * Fetch all non-cancelled bookings for a given date string (e.g. "2026-04-06").
 * Used for slot-blocking logic.
 */
export async function getBookingsForDate(
  date: string
): Promise<BookingRecord[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const db = getFirebaseFirestore();
  const q = query(
    collection(db, 'bookings'),
    where('date', '==', date),
    where('status', '!=', 'cancelled')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => parseBookingRecord(d));
}

/**
 * Update the status field of a booking and set updatedAt.
 */
export async function updateBookingStatus(
  id: string,
  status: BookingRecord['status']
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const db = getFirebaseFirestore();
  const docRef = doc(db, 'bookings', id);
  await updateDoc(docRef, {
    status,
    updatedAt: new Date().toISOString(),
  });
}
