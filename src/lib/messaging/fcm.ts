/**
 * Firebase Cloud Messaging (FCM) — client setup + teardown.
 *
 * Phase 2 / Agent 2F — C9 wire-up.
 *
 * This module is a thin bridge over `@capacitor-firebase/messaging`. It owns:
 *   1. Requesting POST_NOTIFICATIONS at runtime (Android 13+).
 *   2. Creating the default Android notification channel.
 *   3. Fetching the FCM registration token and persisting it to
 *      `users/{uid}.fcmTokens[]` so Cloud Functions can fan out pushes.
 *   4. Removing the token from that array at sign-out.
 *
 * Guardrails:
 *   - No-op on web (Capacitor.isNativePlatform() === false). FCM is currently
 *     only wired for Android; iOS APNs setup comes later.
 *   - Tolerant of a missing `google-services.json`. Without the JSON the
 *     native layer will throw on getToken; that throw is caught and logged,
 *     leaving the rest of the app unaffected. See
 *     `android/app/build.gradle` for the "plugin only applies when JSON
 *     exists" guard that keeps Gradle builds green in that state.
 *   - Never throws to the caller. FCM setup is best-effort; a failure
 *     should never block sign-in.
 */
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { arrayRemove, arrayUnion, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'fcm' });

// Keep in sync with:
//   - AndroidManifest.xml: meta-data
//     com.google.firebase.messaging.default_notification_channel_id
//   - Cloud Functions that publish notifications (they should target this
//     channel id so the priority + visibility declared here take effect).
const DEFAULT_CHANNEL_ID = 'glamornate_default';

export interface FcmSetupResult {
  ready: boolean;
  reason?: string;
  token?: string;
}

/**
 * Request push permissions, create the default Android channel, fetch the
 * FCM registration token, and persist it to `users/{uid}.fcmTokens[]`.
 *
 * Idempotent: safe to call on every sign-in. `arrayUnion` de-duplicates on
 * the server side, so repeated calls do not bloat the array.
 *
 * @param uid - Firebase Auth UID to associate the token with.
 * @returns A result object describing whether setup succeeded and, if not,
 *   a reason string suitable for logging (but not user-facing copy).
 */
export async function setupFcmForUser(uid: string): Promise<FcmSetupResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ready: false, reason: 'not-native' };
  }

  try {
    const perm = await FirebaseMessaging.requestPermissions();
    if (perm.receive !== 'granted') {
      return { ready: false, reason: 'permission-denied' };
    }

    // Create default channel (Android only). Safe to call repeatedly —
    // Android treats this as a no-op once the channel exists. iOS simply
    // rejects the call; swallow that because channels are Android-specific.
    await FirebaseMessaging.createChannel({
      id: DEFAULT_CHANNEL_ID,
      name: 'Glamornate — default',
      description: 'Booking, payment, and promotional notifications',
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
    }).catch(() => {
      // Channels are Android-only. iOS will reject this call; that is
      // expected. Also tolerate duplicate-channel rejections on newer
      // Android versions.
    });

    const { token } = await FirebaseMessaging.getToken();
    if (!token) {
      return { ready: false, reason: 'no-token' };
    }

    // Persist to user doc — merge into fcmTokens array.
    const db = getFirebaseFirestore();
    await setDoc(
      doc(db, 'users', uid),
      {
        fcmTokens: arrayUnion(token),
        fcmTokenUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { ready: true, token };
  } catch (err: unknown) {
    // Critically: do NOT crash the app. FCM is best-effort.
    // Log and return unready so callers can opt to retry. The most common
    // cause of a throw here is a missing google-services.json in the APK;
    // see PHASE-1-BLOCKERS.md "C9 google-services.json" for the user
    // action that resolves it.
    log.warn('setup failed', { error: err });
    return {
      ready: false,
      reason: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/**
 * Remove the current device's token from the user doc. Call from sign-out
 * to stop pushes from being delivered after the user logs out.
 *
 * Note: we do NOT call `FirebaseMessaging.deleteToken()` — that would
 * invalidate the token on every device, not just this one. Instead we
 * simply remove the token from this user's array. On the next sign-in
 * (possibly a different user on the same device), `setupFcmForUser`
 * re-registers it under the new uid.
 */
export async function teardownFcmForUser(uid: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { token } = await FirebaseMessaging.getToken().catch(() => ({
      token: null as string | null,
    }));
    if (!token) return;

    const db = getFirebaseFirestore();
    await setDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) }, { merge: true });
  } catch (err: unknown) {
    log.warn('teardown failed', { error: err });
  }
}

// ---------------------------------------------------------------------------
// Broadcast topic subscription — Phase 1 / Agent 06
//
// These helpers let the client subscribe the current device to FCM topics
// keyed on *audience*, so future admin broadcasts can fan out via a single
// topic publish instead of enumerating every recipient token.
//
// Two topics are wired per signed-in user:
//   - `audience:all`              — every signed-in device across all roles
//   - `audience:role_${role}`     — every signed-in device for a given role
//
// Both calls are:
//   - Native-only (web is a no-op — FCM topics require the Capacitor plugin)
//   - Best-effort — failures are logged but never thrown, because a broken
//     broadcast subscription must never block sign-in or sign-out.
// ---------------------------------------------------------------------------

/**
 * Known broadcast audience roles. Any string is technically valid for the
 * Google backend ([A-Za-z0-9-_.~%]+ up to 900 bytes), so we keep the
 * unsubscribe API widened to `string` for tolerance of legacy role names
 * that may outlive the TypeScript union.
 */
export type BroadcastRole = 'customer' | 'spa_owner' | 'spa_staff' | 'admin';

function buildBroadcastTopics(role: string): readonly string[] {
  return ['audience:all', `audience:role_${role}`] as const;
}

/**
 * Subscribe the current device to the broadcast topics for the given role.
 * Call after {@link setupFcmForUser} on sign-in.
 */
export async function subscribeToBroadcastTopics(role: BroadcastRole): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  for (const topic of buildBroadcastTopics(role)) {
    try {
      await FirebaseMessaging.subscribeToTopic({ topic });
    } catch (err: unknown) {
      // Best-effort: missing google-services.json, APNs not configured, or
      // a transient network hiccup would all land here. Log and move on.
      log.warn('subscribeToBroadcastTopics failed', { topic, error: err });
    }
  }
}

/**
 * Unsubscribe the current device from the broadcast topics for the given
 * role. Call before {@link firebaseSignOut} on sign-out so future broadcasts
 * are not delivered to a device that just signed out.
 *
 * Swallows all errors: stale subscriptions on Google's side auto-expire when
 * the FCM registration token rotates, so a failed unsubscribe is not fatal.
 */
export async function unsubscribeFromBroadcastTopics(role: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  for (const topic of buildBroadcastTopics(role)) {
    try {
      await FirebaseMessaging.unsubscribeFromTopic({ topic });
    } catch (err: unknown) {
      log.warn('unsubscribeFromBroadcastTopics failed', { topic, error: err });
    }
  }
}
