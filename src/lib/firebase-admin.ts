import 'server-only';
import { getApps, initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

const adminLogger = logger.child({ component: 'firebase-admin' });

/**
 * Firebase Admin SDK Configuration for Server-Side API Routes
 *
 * This module provides Firebase Admin SDK instances for Next.js API routes.
 * The admin SDK bypasses security rules and has full read/write access.
 */

let _adminDb: ReturnType<typeof getFirestore> | null = null;

/**
 * Initialize Firebase Admin SDK
 * This should be called once when the app starts
 */
export function initializeFirebaseAdmin() {
  if (!_adminDb) {
    try {
      // Try to load service account credentials from environment
      const serviceAccountConfig = {
        projectId:
          process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        databaseURL: process.env.FIREBASE_ADMIN_DATABASE_URL,
      };

      if (
        serviceAccountConfig.projectId &&
        serviceAccountConfig.clientEmail &&
        serviceAccountConfig.privateKey
      ) {
        const app =
          getApps().length === 0
            ? initializeApp({
                credential: cert(serviceAccountConfig as ServiceAccount),
              })
            : getApps()[0];

        _adminDb = getFirestore(app);
      } else {
        adminLogger.warn('Firebase Admin credentials not found. Using development mode.');
        // In development, use a mock or skip admin operations
      }
    } catch (error) {
      adminLogger.error('Error initializing Firebase Admin', error);
    }
  }

  return _adminDb;
}

/**
 * Get Firestore Admin instance
 * This can be used in API routes with full admin privileges
 */
export function getAdminDb() {
  if (!_adminDb) {
    _adminDb = initializeFirebaseAdmin();
  }
  return _adminDb;
}

// Lazy proxy — avoid calling getAdminDb() at module load time.
// Importing { db } when credentials are absent no longer crashes;
// callers still get null and must handle it.
export const db = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_target, prop, receiver) {
    const real = getAdminDb();
    if (!real) {
      throw new Error('Firebase Admin is not configured — set FIREBASE_ADMIN_* env vars');
    }
    return Reflect.get(real, prop, receiver);
  },
});
export const adminDb = db;
export default db;
