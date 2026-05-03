/**
 * Firestore helpers for persisting a logged-in user's cart.
 *
 * Data layout:
 *   carts/{userId} – single document containing the items array
 *
 * Every public function guards on isFirebaseConfigured() so the app
 * works in demo mode without real Firebase credentials.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { getFirebaseFirestore } from './index';
import { parseCartItems } from './parsers';
import type { CartItem } from '@/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist the current cart items for a logged-in user.
 * Overwrites any previous cart data.
 */
export async function saveCart(
  userId: string,
  items: ReadonlyArray<CartItem>
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const db = getFirebaseFirestore();
  const cartRef = doc(db, 'carts', userId);
  await setDoc(cartRef, { items, updatedAt: new Date().toISOString() });
}

/**
 * Load the persisted cart for a logged-in user.
 * Returns an empty array when the document does not exist or Firebase is not configured.
 */
export async function loadCart(userId: string): Promise<CartItem[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const db = getFirebaseFirestore();
  const cartRef = doc(db, 'carts', userId);
  const snap = await getDoc(cartRef);

  if (!snap.exists()) {
    return [];
  }

  const data = snap.data();
  return parseCartItems(data?.items);
}
