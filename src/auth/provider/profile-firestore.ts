import { User as FirebaseUser } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import * as Sentry from '@sentry/nextjs';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import type { User, SpaData } from '@/types';
import type { logger } from '@/lib/logger';

type Logger = ReturnType<typeof logger.child>;

// Look up spaData for a spa_owner whose Firestore doc is missing it.
//
// 2026-05-11 (Vane-D3 / Keystone-M4 / F3): this used to also write spaData
// back to users/{uid} via updateDoc. The customer-update Firestore rule
// allowlist excludes `spaData`, so every such write was rejected with
// permission-denied, swallowed in the catch, and only papered over via the
// returned in-memory merge — meaning the lookup re-ran on every cold start.
// The authoritative writer is the backend Admin SDK in
// backend/functions/src/utils/spa-registration.ts:101-109 (which bypasses
// rules). The FE now READS spas only as a defensive in-memory fallback for
// legacy spa_owners whose doc somehow lacks spaData; no FE write is attempted.
export async function lookupSpaData(uid: string, log: Logger): Promise<SpaData | null> {
  try {
    const db = getFirebaseFirestore();
    const spasQuery = query(collection(db, 'spas'), where('ownerId', '==', uid), limit(1));
    const snapshot = await getDocs(spasQuery);
    if (snapshot.empty) {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'spa_owner_no_spa_data',
        data: { uid },
        level: 'warning',
      });
      return null;
    }

    const spaDoc = snapshot.docs[0];
    const spaData: SpaData = {
      spaId: spaDoc.id,
      permissions: ['manage_bookings', 'manage_staff', 'manage_services', 'view_analytics'],
      commissionRate: spaDoc.data().commission?.platformRate ?? 0.15,
    };
    return spaData;
  } catch (error: unknown) {
    log.error('Failed to lookup spaData for spa_owner', error);
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'spa_owner_no_spa_data',
      data: { uid, reason: 'lookup_threw' },
      level: 'warning',
    });
    return null;
  }
}

export async function createUserProfile(
  firebaseUser: FirebaseUser,
  additionalData?: { displayName?: string },
  log?: Logger,
): Promise<User> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const userData = userSnap.data() as User;

    // CRIT-001: If spa_owner is missing spaData, look it up from spas collection
    if (userData.role === 'spa_owner' && !userData.spaData?.spaId && log) {
      const spaData = await lookupSpaData(firebaseUser.uid, log);
      if (spaData) {
        return { ...userData, spaData };
      }
    }

    return userData;
  }

  // Build profile without undefined values — Firestore rejects undefined fields
  const { email, displayName, photoURL, phoneNumber } = firebaseUser;
  const profile = {
    displayName: additionalData?.displayName || displayName || 'New User',
    ...(email && { email }),
    ...(phoneNumber && { phone: phoneNumber }),
    ...(photoURL && { photo: photoURL }),
  };

  const newUser: User = {
    authProvider: email ? 'email' : 'google',
    role: 'customer',
    profile,
    emailVerified: firebaseUser.emailVerified,
    phoneVerified: !!phoneNumber,
    preferences: {
      language: 'en',
      notifications: { email: true, push: true, sms: false },
    },
    customerData: { favorites: [], history: [] },
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(userRef, {
    authProvider: newUser.authProvider,
    role: 'customer',
    profile,
    emailVerified: newUser.emailVerified,
    phoneVerified: newUser.phoneVerified,
    preferences: newUser.preferences,
    customerData: newUser.customerData,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });

  return newUser;
}

// Fetch user profile from Firestore with one retry on permission-denied
// (rules-propagation race after first sign-in).
export async function fetchUserProfile(fbUser: FirebaseUser, log: Logger): Promise<User | null> {
  try {
    const db = getFirebaseFirestore();
    const userRef = doc(db, 'users', fbUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as User;

      // Backfill spaData for spa_owner if missing (mirrors createUserProfile logic)
      if (userData.role === 'spa_owner' && !userData.spaData?.spaId) {
        const spaData = await lookupSpaData(fbUser.uid, log);
        if (spaData) {
          return { ...userData, spaData };
        }
      }

      return userData;
    } else {
      // A-2-04: Drop listener auto-create. Imperative paths (signUp,
      // signInWithGoogle popup, signInWithGoogle native) all call
      // createUserProfile before the listener runs. Returning null here
      // routes through the orphan-session cleanup (A-2-03) instead of
      // racing a second setDoc against the imperative one.
      log.warn(
        'User profile missing in Firestore — listener will not auto-create; sign-in handler should have created it',
        { uid: fbUser.uid },
      );
      return null;
    }
  } catch (error: unknown) {
    // 2026-05-11 (Cinder-D1 / F38): use the typed `.code` field, not the
    // brittle `String(error).includes('permissions')` fallback. Firebase
    // SDKs sometimes localise error messages but the `.code` is stable.
    const code = (error as { code?: string })?.code ?? '';
    if (code === 'permission-denied') {
      log.warn('Firestore auth not synced yet — retrying in 1.5s', { uid: fbUser.uid });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        await fbUser.getIdToken(true);
        const db = getFirebaseFirestore();
        const userRef = doc(db, 'users', fbUser.uid);
        const retrySnap = await getDoc(userRef);
        if (retrySnap.exists()) {
          const userData = retrySnap.data() as User;
          if (userData.role === 'spa_owner' && !userData.spaData?.spaId) {
            const spaData = await lookupSpaData(fbUser.uid, log);
            if (spaData) {
              return { ...userData, spaData };
            }
          }
          return userData;
        }
        log.warn('Profile not found on retry — listener orphan-cleanup will route', {
          uid: fbUser.uid,
        });
        return null;
      } catch (retryError: unknown) {
        log.error('Retry also failed', retryError);
        // Retry failed AFTER permission-denied — could be persistent or
        // transient. Throw so the listener's outer catch keeps last-known
        // state rather than orphan-cleaning the user. See F14.
        throw retryError;
      }
    }
    // 2026-05-11 (Vane-D2 / F14 + M-F3): non-`permission-denied` Firestore
    // errors (`unavailable`, `deadline-exceeded`, `internal`, network blip)
    // are TRANSIENT, not "doc does not exist." Returning null here used to
    // route through orphan-cleanup → silent firebaseSignOut on every
    // network hiccup. We throw instead — the listener's outer catch (T3-F8,
    // see end of the listener body) clears BOTH firebaseUser AND user to a
    // consistent signed-out state so the next signIn re-fires the listener
    // cleanly. The previous wording here ("keeps last-known state") was
    // drift — T3-F8 changed the contract to "clear both"; the comment now
    // matches reality.
    log.error('Error fetching user profile (transient)', error);
    throw error;
  }
}
