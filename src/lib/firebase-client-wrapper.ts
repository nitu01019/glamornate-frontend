'use client';

/**
 * Firebase Client Wrapper
 *
 * This module provides comprehensive Firebase client services for client-side use.
 * It handles Firestore queries, real-time subscriptions, and Cloud Functions calls.
 * All methods gracefully handle cases where Firebase is not configured.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  DocumentData,
  QueryConstraint,
  WhereFilterOp,
  OrderByDirection,
  Unsubscribe,
  DocumentSnapshot,
} from 'firebase/firestore';
import * as Sentry from '@sentry/nextjs';
import { httpsCallable } from 'firebase/functions';
import { getFirestoreDb, getFirebaseApp, isFirebaseConfigured } from './firebase';
import { getFunctions } from 'firebase/functions';
import {
  parseError,
  AppError,
  AppCheckError,
  NetworkError,
  FirebaseError as AppFirebaseError,
} from './error-handler';
import { logger } from './logger';
import { getAppCheckToken } from './app-check';

// Dedupe App Check callable breadcrumbs: at most once per session per function.
const _appCheckMissingCallables = new Set<string>();

// =============================================================================
// Types
// =============================================================================

export type ConstraintType = 'where' | 'orderBy' | 'limit' | 'startAfter';

export interface WhereConstraint {
  type: 'where';
  field: string;
  operator: WhereFilterOp;
  value: unknown;
}

export interface OrderByConstraint {
  type: 'orderBy';
  field: string;
  direction?: OrderByDirection;
}

export interface LimitConstraint {
  type: 'limit';
  count: number;
}

export interface StartAfterConstraint {
  type: 'startAfter';
  cursor: unknown;
}

export type QueryConstraintConfig =
  | WhereConstraint
  | OrderByConstraint
  | LimitConstraint
  | StartAfterConstraint;

export interface DocumentWithId<T> {
  id: string;
  data: T;
}

export interface QueryResult<T> {
  documents: DocumentWithId<T>[];
  lastDoc?: DocumentSnapshot;
}

export interface CallableFunctionResult<T> {
  data: T;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert Firestore Timestamps to ISO strings in document data
 */
function convertTimestamps<T extends DocumentData>(data: T): T {
  const converted = { ...data };

  for (const key in converted) {
    const value = converted[key];
    // Check if it's a Firestore Timestamp by duck typing
    if (
      value &&
      typeof value === 'object' &&
      'toDate' in value &&
      typeof value.toDate === 'function'
    ) {
      try {
        (converted as Record<string, unknown>)[key] = value.toDate().toISOString();
      } catch {
        // If toDate() fails, keep the original value
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      (converted as Record<string, unknown>)[key] = convertTimestamps(value as DocumentData);
    }
  }

  return converted;
}

/**
 * Build Firestore query constraints from config array
 */
function buildConstraints(configs: QueryConstraintConfig[]): QueryConstraint[] {
  return configs.map((config) => {
    switch (config.type) {
      case 'where':
        return where(config.field, config.operator, config.value);
      case 'orderBy':
        return orderBy(config.field, config.direction ?? 'asc');
      case 'limit':
        return limit(config.count);
      case 'startAfter':
        return startAfter(config.cursor);
      default:
        throw new Error(`Unknown constraint type: ${(config as QueryConstraintConfig).type}`);
    }
  });
}

// =============================================================================
// Firebase Client Wrapper Class
// =============================================================================

class FirebaseClientWrapper {
  private wrapperLogger = logger.child({ component: 'FirebaseClientWrapper' });

  /**
   * Check if Firebase is configured and available
   */
  private checkFirebaseAvailable(): boolean {
    if (typeof window === 'undefined') {
      this.wrapperLogger.warn('Firebase client can only be used on client side');
      return false;
    }

    if (!isFirebaseConfigured()) {
      this.wrapperLogger.warn('Firebase is not configured');
      return false;
    }

    return true;
  }

  // ===========================================================================
  // Document Operations
  // ===========================================================================

  /**
   * Get a single document by ID
   */
  async getDocument<T extends DocumentData>(
    collectionName: string,
    documentId: string,
  ): Promise<DocumentWithId<T> | null> {
    if (!this.checkFirebaseAvailable()) {
      return null;
    }

    try {
      const db = getFirestoreDb();
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = convertTimestamps(docSnap.data() as T);
      return { id: docSnap.id, data };
    } catch (error) {
      this.wrapperLogger.error('Failed to get document', error, { collectionName, documentId });
      throw parseError(error);
    }
  }

  /**
   * Query documents with constraints
   */
  async getDocuments<T extends DocumentData>(
    collectionName: string,
    constraints: QueryConstraintConfig[] = [],
  ): Promise<QueryResult<T>> {
    if (!this.checkFirebaseAvailable()) {
      return { documents: [] };
    }

    try {
      const db = getFirestoreDb();
      const collectionRef = collection(db, collectionName);
      const queryConstraints = buildConstraints(constraints);
      const q = query(collectionRef, ...queryConstraints);
      const snapshot = await getDocs(q);

      const documents = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: convertTimestamps(docSnap.data() as T),
      }));

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];

      return { documents, lastDoc };
    } catch (error) {
      this.wrapperLogger.error('Failed to get documents', error, { collectionName, constraints });
      // Phase 8 (Booking Flow Fix v3.1, 2026-05-02, Patch H5): classify
      // App-Check denials so the bookings list can render the
      // typed-error UI instead of a generic empty state.
      throw await this.classifyFirestoreReadError(error, { collectionName });
    }
  }

  /**
   * Create a new document
   */
  async createDocument<T extends DocumentData>(collectionName: string, data: T): Promise<string> {
    if (!this.checkFirebaseAvailable()) {
      throw new AppFirebaseError('Firebase is not configured', { isRetryable: false });
    }

    try {
      const db = getFirestoreDb();
      const collectionRef = collection(db, collectionName);
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      this.wrapperLogger.info('Document created', { collectionName, documentId: docRef.id });
      return docRef.id;
    } catch (error) {
      this.wrapperLogger.error('Failed to create document', error, { collectionName });
      throw parseError(error);
    }
  }

  /**
   * Update an existing document
   */
  async updateDocument(
    collectionName: string,
    documentId: string,
    data: Partial<DocumentData>,
  ): Promise<void> {
    if (!this.checkFirebaseAvailable()) {
      throw new AppFirebaseError('Firebase is not configured', { isRetryable: false });
    }

    try {
      const db = getFirestoreDb();
      const docRef = doc(db, collectionName, documentId);

      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });

      this.wrapperLogger.info('Document updated', { collectionName, documentId });
    } catch (error) {
      this.wrapperLogger.error('Failed to update document', error, { collectionName, documentId });
      throw parseError(error);
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    if (!this.checkFirebaseAvailable()) {
      throw new AppFirebaseError('Firebase is not configured', { isRetryable: false });
    }

    try {
      const db = getFirestoreDb();
      const docRef = doc(db, collectionName, documentId);
      await deleteDoc(docRef);

      this.wrapperLogger.info('Document deleted', { collectionName, documentId });
    } catch (error) {
      this.wrapperLogger.error('Failed to delete document', error, { collectionName, documentId });
      throw parseError(error);
    }
  }

  // ===========================================================================
  // Real-time Subscriptions
  // ===========================================================================

  /**
   * Subscribe to a single document's changes
   */
  subscribeToDocument<T extends DocumentData>(
    collectionName: string,
    documentId: string,
    callback: (data: DocumentWithId<T> | null, error?: AppError) => void,
  ): Unsubscribe {
    if (!this.checkFirebaseAvailable()) {
      // Return a no-op unsubscribe function
      callback(null);
      return () => {};
    }

    try {
      const db = getFirestoreDb();
      const docRef = doc(db, collectionName, documentId);

      return onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = convertTimestamps(docSnap.data() as T);
            callback({ id: docSnap.id, data });
          } else {
            callback(null);
          }
        },
        async (error) => {
          this.wrapperLogger.error('Document subscription error', error, {
            collectionName,
            documentId,
          });
          callback(
            null,
            await this.classifyFirestoreReadError(error, { collectionName, documentId }),
          );
        },
      );
    } catch (error) {
      this.wrapperLogger.error('Failed to subscribe to document', error, {
        collectionName,
        documentId,
      });
      // sync-classify by best-effort; awaited path used inside onSnapshot
      callback(null, parseError(error));
      return () => {};
    }
  }

  /**
   * Subscribe to a query's changes
   */
  subscribeToQuery<T extends DocumentData>(
    collectionName: string,
    constraints: QueryConstraintConfig[],
    callback: (data: DocumentWithId<T>[], error?: AppError) => void,
  ): Unsubscribe {
    if (!this.checkFirebaseAvailable()) {
      callback([]);
      return () => {};
    }

    try {
      const db = getFirestoreDb();
      const collectionRef = collection(db, collectionName);
      const queryConstraints = buildConstraints(constraints);
      const q = query(collectionRef, ...queryConstraints);

      return onSnapshot(
        q,
        (snapshot) => {
          const documents = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            data: convertTimestamps(docSnap.data() as T),
          }));
          callback(documents);
        },
        async (error) => {
          this.wrapperLogger.error('Query subscription error', error, {
            collectionName,
            constraints,
          });
          callback([], await this.classifyFirestoreReadError(error, { collectionName }));
        },
      );
    } catch (error) {
      this.wrapperLogger.error('Failed to subscribe to query', error, {
        collectionName,
        constraints,
      });
      callback([], parseError(error));
      return () => {};
    }
  }

  // ===========================================================================
  // Cloud Functions
  // ===========================================================================

  /**
   * Call a Firebase callable function
   */
  async callFunction<
    TRequest extends Record<string, unknown> | undefined = undefined,
    TResponse = unknown,
  >(functionName: string, data?: TRequest): Promise<TResponse> {
    if (!this.checkFirebaseAvailable()) {
      throw new AppFirebaseError('Firebase is not configured', { isRetryable: false });
    }

    // Probe App Check up-front so the catch block can disambiguate
    // "request fired with no token, backend rejected" from "transient
    // network blip". Without this, every TypeError-shaped failure
    // collapsed into the lossy "Network request failed" toast (the bug
    // we hit on the debug-signed APK that lacked a registered debug
    // token). See /Users/nitishbhardwaj/.claude/plans/apk-network-request-failed-systematic-debug.md.
    let appCheckToken: string | null = null;
    try {
      appCheckToken = await getAppCheckToken();
    } catch {
      appCheckToken = null;
    }
    const tokenWasPresent = appCheckToken !== null;

    if (
      process.env.NODE_ENV === 'production' &&
      !tokenWasPresent &&
      !_appCheckMissingCallables.has(functionName)
    ) {
      _appCheckMissingCallables.add(functionName);
      Sentry.addBreadcrumb({
        category: 'app_check',
        message: 'callable_no_token',
        level: 'warning',
        data: { functionName },
      });
    }

    try {
      const app = getFirebaseApp();
      // Pin to us-central1 to match the backend deploy region (see
      // backend/functions/src/utils/callable-opts.ts — `callableOpts` does
      // not chain `.region(...)` so the v1 default is `us-central1`). On
      // Capacitor native, omitting the region intermittently routed to a
      // wrong endpoint and surfaced as "network request failed".
      const functions = getFunctions(app, 'us-central1');
      const callable = httpsCallable<TRequest, TResponse>(functions, functionName);

      this.wrapperLogger.debug('Calling function', { functionName, tokenWasPresent });
      const result = await callable(data as TRequest);
      this.wrapperLogger.debug('Function call successful', { functionName });

      return result.data;
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      const rawMessage = (error as { message?: string })?.message ?? '';
      const message = rawMessage.toLowerCase();

      const isTransient =
        code === 'functions/unavailable' ||
        code === 'functions/cancelled' ||
        code === 'functions/deadline-exceeded' ||
        code === 'unavailable';

      // App Check rejection — three shapes, in order of decreasing reliability:
      //   (a) A-6-11: server propagates explicit `details.reason === 'app-check'`
      //       in the HttpsError data — deterministic, no string-matching.
      //   (b) error message explicitly mentions App Check (server envelope
      //       leaks through, or Firebase SDK surfaces it).
      //   (c) request was fired with no `X-Firebase-AppCheck` header AND the
      //       server returned `functions/internal` / `functions/unauthenticated`,
      //       which is the exact pattern an `enforceAppCheck:true` callable
      //       produces when token mint failed (see
      //       backend/functions/src/utils/callable-opts.ts).
      const errorDetails = (error as { details?: { reason?: string } } | null)?.details;
      const appCheckRejected =
        errorDetails?.reason === 'app-check' ||
        message.includes('app check') ||
        message.includes('app-check') ||
        (!tokenWasPresent &&
          (code === 'functions/internal' || code === 'functions/unauthenticated'));

      const classification = appCheckRejected
        ? 'app_check_rejected'
        : isTransient
        ? 'transient'
        : 'other';

      Sentry.addBreadcrumb({
        category: 'callable_error',
        message: functionName,
        level: appCheckRejected || isTransient ? 'warning' : 'error',
        data: {
          functionName,
          code,
          tokenWasPresent,
          classification,
          region: 'us-central1',
        },
      });

      if (appCheckRejected) {
        this.wrapperLogger.warn('Callable rejected by App Check enforcement', {
          functionName,
          code,
          tokenWasPresent,
        });
        throw new AppCheckError(undefined, {
          tokenWasPresent,
          cause: error instanceof Error ? error : undefined,
          context: { functionName, code, message: rawMessage },
        });
      }

      if (isTransient) {
        this.wrapperLogger.warn('Function call unavailable', { functionName, code });
        throw new NetworkError(rawMessage || 'Connection hiccup', {
          kind: 'transient',
          cause: error instanceof Error ? error : undefined,
          context: { functionName, code },
        });
      }

      this.wrapperLogger.error('Function call failed', error, { functionName });
      throw parseError(error);
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Phase 8 (Booking Flow Fix v3.1, 2026-05-02, Patch H5): classify a
   * Firestore read failure into AppCheckError | NetworkError | other.
   * Mirrors the callable-path classification at the top of `callFunction`
   * so the bookings list can render the typed-error UI on read paths
   * too. Sentry breadcrumbs include `appCheckTokenPresent` so a missing
   * native token shows up unambiguously in production logs.
   */
  private async classifyFirestoreReadError(
    error: unknown,
    context: Record<string, unknown>,
  ): Promise<AppError> {
    const tokenWasPresent = !!(await getAppCheckToken().catch(() => null));
    const code = (error as { code?: string } | undefined)?.code ?? '';
    const message = String((error as Error | undefined)?.message ?? '').toLowerCase();

    const appCheckRejected =
      message.includes('app check') ||
      message.includes('app-check') ||
      (!tokenWasPresent && (code === 'permission-denied' || code === 'unauthenticated'));

    Sentry.addBreadcrumb({
      category: 'firestore_read_error',
      level: appCheckRejected ? 'warning' : 'error',
      data: {
        ...context,
        code,
        tokenWasPresent,
        classification: appCheckRejected ? 'app_check_rejected' : 'other',
      },
    });

    if (appCheckRejected) {
      return new AppCheckError(undefined, {
        tokenWasPresent,
        cause: error instanceof Error ? error : undefined,
        context: { ...context, code },
      });
    }
    return parseError(error);
  }

  /**
   * Check if a document exists
   */
  async documentExists(collectionName: string, documentId: string): Promise<boolean> {
    if (!this.checkFirebaseAvailable()) {
      return false;
    }

    try {
      const db = getFirestoreDb();
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      this.wrapperLogger.error('Failed to check document existence', error, {
        collectionName,
        documentId,
      });
      return false;
    }
  }

  /**
   * Count documents matching a query (uses getDocs and counts - Firestore limitation)
   */
  async countDocuments(
    collectionName: string,
    constraints: QueryConstraintConfig[] = [],
  ): Promise<number> {
    if (!this.checkFirebaseAvailable()) {
      return 0;
    }

    try {
      const result = await this.getDocuments(collectionName, constraints);
      return result.documents.length;
    } catch (error) {
      this.wrapperLogger.error('Failed to count documents', error, { collectionName });
      return 0;
    }
  }

  /**
   * Get subcollection documents
   */
  async getSubcollectionDocuments<T extends DocumentData>(
    parentCollection: string,
    parentId: string,
    subcollection: string,
    constraints: QueryConstraintConfig[] = [],
  ): Promise<QueryResult<T>> {
    if (!this.checkFirebaseAvailable()) {
      return { documents: [] };
    }

    try {
      const db = getFirestoreDb();
      const subcollectionRef = collection(db, parentCollection, parentId, subcollection);
      const queryConstraints = buildConstraints(constraints);
      const q = query(subcollectionRef, ...queryConstraints);
      const snapshot = await getDocs(q);

      const documents = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: convertTimestamps(docSnap.data() as T),
      }));

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];

      return { documents, lastDoc };
    } catch (error) {
      this.wrapperLogger.error('Failed to get subcollection documents', error, {
        parentCollection,
        parentId,
        subcollection,
      });
      throw parseError(error);
    }
  }

  /**
   * Create a document inside a subcollection
   */
  async createSubcollectionDocument<T extends DocumentData>(
    parentCollection: string,
    parentId: string,
    subcollection: string,
    data: T,
  ): Promise<string> {
    if (!this.checkFirebaseAvailable()) {
      throw new AppFirebaseError('Firebase is not configured', { isRetryable: false });
    }

    try {
      const db = getFirestoreDb();
      const subcollectionRef = collection(db, parentCollection, parentId, subcollection);
      const docRef = await addDoc(subcollectionRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      this.wrapperLogger.info('Subcollection document created', {
        parentCollection,
        parentId,
        subcollection,
        documentId: docRef.id,
      });
      return docRef.id;
    } catch (error) {
      this.wrapperLogger.error('Failed to create subcollection document', error, {
        parentCollection,
        parentId,
        subcollection,
      });
      throw parseError(error);
    }
  }

  /**
   * Update a document inside a subcollection
   */
  async updateSubcollectionDocument(
    parentCollection: string,
    parentId: string,
    subcollection: string,
    documentId: string,
    data: Partial<DocumentData>,
  ): Promise<void> {
    if (!this.checkFirebaseAvailable()) {
      throw new AppFirebaseError('Firebase is not configured', { isRetryable: false });
    }

    try {
      const db = getFirestoreDb();
      const docRef = doc(db, parentCollection, parentId, subcollection, documentId);

      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });

      this.wrapperLogger.info('Subcollection document updated', {
        parentCollection,
        parentId,
        subcollection,
        documentId,
      });
    } catch (error) {
      this.wrapperLogger.error('Failed to update subcollection document', error, {
        parentCollection,
        parentId,
        subcollection,
        documentId,
      });
      throw parseError(error);
    }
  }

  /**
   * Delete a document inside a subcollection
   */
  async deleteSubcollectionDocument(
    parentCollection: string,
    parentId: string,
    subcollection: string,
    documentId: string,
  ): Promise<void> {
    if (!this.checkFirebaseAvailable()) {
      throw new AppFirebaseError('Firebase is not configured', { isRetryable: false });
    }

    try {
      const db = getFirestoreDb();
      const docRef = doc(db, parentCollection, parentId, subcollection, documentId);
      await deleteDoc(docRef);

      this.wrapperLogger.info('Subcollection document deleted', {
        parentCollection,
        parentId,
        subcollection,
        documentId,
      });
    } catch (error) {
      this.wrapperLogger.error('Failed to delete subcollection document', error, {
        parentCollection,
        parentId,
        subcollection,
        documentId,
      });
      throw parseError(error);
    }
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const firebaseClientWrapper = new FirebaseClientWrapper();

// =============================================================================
// Legacy Exports (for backward compatibility)
// =============================================================================

// Import service types from firebase-client
type SpaService = typeof import('@/lib/firebase-client').spaService;
type ServiceCatalogService = typeof import('@/lib/firebase-client').serviceCatalogService;
type AuthService = typeof import('@/lib/firebase-client').authService;
type UserService = typeof import('@/lib/firebase-client').userService;
type BookingService = typeof import('@/lib/firebase-client').bookingService;
type TherapistService = typeof import('@/lib/firebase-client').therapistService;
type ReviewService = typeof import('@/lib/firebase-client').reviewService;
type AvailabilityService = typeof import('@/lib/firebase-client').availabilityService;

export interface FirebaseClientServices {
  spaService: SpaService;
  serviceCatalogService: ServiceCatalogService;
  authService: AuthService;
  userService: UserService;
  bookingService: BookingService;
  therapistService: TherapistService;
  reviewService: ReviewService;
  availabilityService: AvailabilityService;
}

let firebaseClientCache: FirebaseClientServices | null = null;

export async function getFirebaseClient(): Promise<FirebaseClientServices> {
  if (typeof window === 'undefined') {
    throw new Error('Firebase client can only be used on client side');
  }

  if (firebaseClientCache) {
    return firebaseClientCache;
  }

  try {
    // Dynamic import to avoid server-side compilation
    const firebaseClient = await import('@/lib/firebase-client');

    firebaseClientCache = {
      spaService: firebaseClient.spaService,
      serviceCatalogService: firebaseClient.serviceCatalogService,
      authService: firebaseClient.authService,
      userService: firebaseClient.userService,
      bookingService: firebaseClient.bookingService,
      therapistService: firebaseClient.therapistService,
      reviewService: firebaseClient.reviewService,
      availabilityService: firebaseClient.availabilityService,
    };

    return firebaseClientCache;
  } catch {
    logger.warn('Failed to load @/lib/firebase-client');
    // Return a mock/empty service set for demo mode
    throw new Error('Firebase client not available');
  }
}

export async function initializeFirebase() {
  // Dynamic import to avoid server-side compilation
  const { initializeFirebaseApp } = await import('./firebase-config');
  await initializeFirebaseApp();
}
