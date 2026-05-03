/**
 * Firebase Configuration - Re-export from canonical source
 *
 * This module re-exports everything from '@/lib/firebase-client/config'
 * which is the single source of truth for Firebase configuration.
 *
 * Kept as a redirect to avoid breaking any existing imports from this path.
 */
export {
  FirebaseConfigManager,
  firebaseConfig,
  type FirebaseConfig,
} from '@/lib/firebase-client/config';

export {
  initializeFirebaseApp,
  isFirebaseConfigured,
  getMissingConfigKeys,
  shouldUseMock,
} from '@/lib/firebase-config';
