/**
 * Firebase Instance Access (Thin Wrapper)
 *
 * Delegates to @/lib/firebase-client for all Firebase instances.
 * Initialization happens via firebase-config.ts -> @/lib/firebase-client.initializeFirebase().
 * isFirebaseConfigured() is the single source in firebase-config.ts, re-exported here.
 */

import { getFirebaseFirestore } from '@/lib/firebase-client';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

// Re-export instance getters from the shared package
export { getFirebaseAuth, getFirebaseApp } from '@/lib/firebase-client';

// Single source for isFirebaseConfigured — defined in firebase-config.ts
export { isFirebaseConfigured } from './firebase-config';

/**
 * Get Firestore instance
 * Alias for getFirebaseFirestore from @/lib/firebase-client
 */
export function getFirestoreDb(): Firestore {
  return getFirebaseFirestore();
}

// Export types
export type { FirebaseApp, Auth, Firestore };
