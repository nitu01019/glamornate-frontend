/**
 * Firebase Configuration - Re-export from canonical source
 *
 * This module re-exports everything from '@/lib/firebase-client/config'
 * which is the single source of truth for Firebase configuration.
 *
 * Many files import from this path, so it is kept as a redirect
 * to avoid breaking existing imports.
 */
export {
  FirebaseConfigManager,
  firebaseConfig,
  type FirebaseConfig,
} from '@/lib/firebase-client/config';

import { firebaseConfig as configManager } from '@/lib/firebase-client/config';
import type { FirebaseOptions } from 'firebase/app';
import { logger } from '@/lib/logger';

let firebaseInitialized = false;

/**
 * Initialize Firebase - uses dynamic import to avoid build issues
 */
export async function initializeFirebaseApp(
  config?: FirebaseOptions
): Promise<void> {
  if (firebaseInitialized) return;

  if (typeof window === 'undefined') return; // Only initialize on client

  try {
    const { initializeFirebase } = await import('@/lib/firebase-client');
    const options = config || configManager.getFirebaseOptions();
    initializeFirebase(options);
    firebaseInitialized = true;
    logger.info('Firebase client initialized successfully', { component: 'firebase-config' });
  } catch (error) {
    logger.error('Error initializing Firebase', error, { component: 'firebase-config' });
    throw error;
  }
}

/**
 * Check if required Firebase config is present.
 * Delegates to FirebaseConfigManager.
 */
export function isFirebaseConfigured(): boolean {
  return configManager.isConfigured();
}

/**
 * Get missing config keys.
 * Delegates to FirebaseConfigManager.
 */
export function getMissingConfigKeys(): string[] {
  return configManager.getMissingKeys();
}

/**
 * Check whether mock mode should be used.
 * Delegates to FirebaseConfigManager.
 */
export function shouldUseMock(): boolean {
  return configManager.shouldUseMock();
}
