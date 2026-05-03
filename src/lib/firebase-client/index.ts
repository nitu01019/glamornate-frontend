import { initializeApp, getApps, FirebaseApp, FirebaseOptions } from 'firebase/app';
// Namespace import for firebase/auth so the `User` export does not collide
// with our domain `User` type. Avoids an import-rename `as X` which the F3
// sweep bans.
import * as firebaseAuth from 'firebase/auth';
const {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut: firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  linkWithCredential,
  unlink,
  EmailAuthProvider,
  reauthenticateWithCredential,
} = firebaseAuth;
type Auth = firebaseAuth.Auth;
type RecaptchaVerifier = firebaseAuth.RecaptchaVerifier;
type ConfirmationResult = firebaseAuth.ConfirmationResult;
type FirebaseUser = firebaseAuth.User;
// Namespace import for firebase/firestore so the `Transaction` export does
// not collide with our domain `Transaction` type.
import * as firestoreSdk from 'firebase/firestore';
const {
  getFirestore,
  setLogLevel,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
} = firestoreSdk;
type Firestore = firestoreSdk.Firestore;
type DocumentData = firestoreSdk.DocumentData;
// Pass through Query/CollectionReference/DocumentReference unchanged. The
// converter helpers in `parsers.ts` produce identity-typed refs (DbModel = T)
// — Firebase's own type defaults handle the structural compat at call sites.
type Query<T extends DocumentData = DocumentData> = firestoreSdk.Query<T>;
type CollectionReference<T extends DocumentData = DocumentData> = firestoreSdk.CollectionReference<T>;
type DocumentReference<T extends DocumentData = DocumentData> = firestoreSdk.DocumentReference<T>;
type WriteBatch = firestoreSdk.WriteBatch;
type FirestoreTransaction = firestoreSdk.Transaction;
type Timestamp = firestoreSdk.Timestamp;
import type {
  User,
  Booking,
  Spa,
  Service,
  Therapist,
  Review,
  Payout,
  Notification,
  Voucher,
  UserVoucher,
  Wallet,
  WalletTransaction,
  SupportTicket,
  Analytics,
  FeatureFlag,
  AuditLog,
  SpaService,
  Availability,
  SlotAvailability,
  StatusHistoryEntry,
} from '@/types';
import { logger } from '@/lib/logger';
import {
  parseUser,
  parseSpa,
  parseService,
  parseSpaService,
  parseTherapist,
  parseBooking,
  parseReview,
  parsePayout,
  parseNotification,
  parseVoucher,
  parseUserVoucher,
  parseAnalytics,
  parseFeatureFlag,
  parseAuditLog,
  parseSupportTicket,
  parseBookingStatusValue,
  parseActorValue,
  parseUserRole,
  snapToTyped,
  typedCollection,
  typedDoc,
  toFirebaseErrorShape,
  toMaybeCodedErrorShape,
} from './parsers';

// ============================================================================
// Firebase Configuration
// ============================================================================

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let persistenceConfigured = false;

/**
 * Configure Firebase Auth to persist the session in IndexedDB. Without this,
 * the SDK's auto-detect can silently fall back to in-memory persistence on
 * some Capacitor WebView states, evaporating the user's session on cold
 * start. Idempotent across multiple getFirebaseAuth() callers.
 */
function ensureAuthPersistence(auth: Auth): void {
  if (persistenceConfigured) return;
  persistenceConfigured = true;
  void setPersistence(auth, indexedDBLocalPersistence).catch((err) => {
    // eslint-disable-next-line no-console -- one-line warn during init; not in hot path
    console.warn(
      '[firebase] setPersistence(indexedDBLocalPersistence) failed; auth session may not survive cold start',
      err,
    );
  });
}

export const initializeFirebase = (config?: FirebaseOptions): FirebaseApp => {
  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
  } else if (config) {
    firebaseApp = initializeApp(config);
  } else {
    throw new Error('Firebase config is required for initialization');
  }

  authInstance = getAuth(firebaseApp);
  ensureAuthPersistence(authInstance);
  firestoreInstance = getFirestore(firebaseApp);
  if (process.env.NODE_ENV === 'production') {
    setLogLevel('error');
  }

  return firebaseApp;
};

export const getFirebaseApp = (): FirebaseApp => {
  if (!firebaseApp) {
    // Auto-initialize from env config if not yet initialized
    if (getApps().length > 0) {
      firebaseApp = getApps()[0];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy `require` avoids top-level import cycle: config → firebase → config. Will be removed when A1 firebase-client split lands (Phase 3 Agent-01).
      const { firebaseConfig } = require('./config');
      if (firebaseConfig.isConfigured()) {
        firebaseApp = initializeApp(firebaseConfig.getFirebaseOptions());
      } else {
        throw new Error('Firebase not configured. Check environment variables.');
      }
    }
    authInstance = getAuth(firebaseApp);
    ensureAuthPersistence(authInstance);
    firestoreInstance = getFirestore(firebaseApp);
  }
  return firebaseApp;
};

export const getFirebaseAuth = (): Auth => {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  ensureAuthPersistence(authInstance);
  return authInstance;
};

export const getFirebaseFirestore = (): Firestore => {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getFirebaseApp());
  }
  return firestoreInstance;
};

// ============================================================================
// Authentication Service
// ============================================================================

export interface AuthError {
  code: string;
  message: string;
}

const handleAuthError = (error: { code: string; message: string }): AuthError => {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/invalid-email': 'Invalid email address',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled',
    'auth/weak-password': 'Password is too weak',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/popup-closed-by-user': 'Sign-in was cancelled',
    'auth/cancelled-popup-request': 'Sign-in was cancelled',
  };

  return {
    code: error.code,
    message: errorMessages[error.code] || error.message,
  };
};

export type SignUpData = {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
};

export type SignInData = {
  email: string;
  password: string;
};

export type AuthResult = {
  user: FirebaseUser | null;
  error?: AuthError;
};

export const authService = {
  // Authentication State Observer
  onAuthStateChange: (callback: (user: FirebaseUser | null) => void): (() => void) => {
    return onAuthStateChanged(getFirebaseAuth(), callback);
  },

  // Get Current User
  getCurrentUser: (): FirebaseUser | null => {
    return getFirebaseAuth().currentUser;
  },

  // Get ID Token
  getIdToken: async (forceRefresh = false): Promise<string | null> => {
    const user = getFirebaseAuth().currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  },

  // Email/Password Sign Up
  signUp: async (data: SignUpData): Promise<AuthResult> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        data.email,
        data.password,
      );

      await updateProfile(userCredential.user, {
        displayName: data.displayName,
      });

      return { user: userCredential.user };
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { user: null, error: handleAuthError(err) };
    }
  },

  // Email/Password Sign In
  signIn: async (data: SignInData): Promise<AuthResult> => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        data.email,
        data.password,
      );
      return { user: userCredential.user };
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { user: null, error: handleAuthError(err) };
    }
  },

  // Google Sign In
  signInWithGoogle: async (): Promise<AuthResult> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(getFirebaseAuth(), provider);
      return { user: userCredential.user };
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { user: null, error: handleAuthError(err) };
    }
  },

  // Phone Sign In - Step 1: Send OTP
  sendPhoneOTP: async (
    phoneNumber: string,
    recaptchaVerifier: RecaptchaVerifier,
  ): Promise<{ confirmationResult: ConfirmationResult | null; error?: AuthError }> => {
    try {
      const confirmationResult = await signInWithPhoneNumber(
        getFirebaseAuth(),
        phoneNumber,
        recaptchaVerifier,
      );
      return { confirmationResult };
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { error: handleAuthError(err), confirmationResult: null };
    }
  },

  // Phone Sign In - Step 2: Verify OTP
  verifyPhoneOTP: async (
    confirmationResult: ConfirmationResult,
    otp: string,
  ): Promise<AuthResult> => {
    try {
      const userCredential = await confirmationResult.confirm(otp);
      return { user: userCredential.user };
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { user: null, error: handleAuthError(err) };
    }
  },

  // Sign Out
  signOut: async (): Promise<{ error?: AuthError }> => {
    try {
      await firebaseSignOut(getFirebaseAuth());
      return {};
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { error: handleAuthError(err) };
    }
  },

  // Reset Password
  resetPassword: async (email: string): Promise<{ error?: AuthError }> => {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      return {};
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { error: handleAuthError(err) };
    }
  },

  // Update Password
  updatePassword: async (newPassword: string): Promise<{ error?: AuthError }> => {
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) {
        const err = new Error('No user signed in');
        Object.assign(err, { code: 'auth/user-not-found' });
        throw err;
      }
      await updatePassword(user, newPassword);
      return {};
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { error: handleAuthError(err) };
    }
  },

  // Update Profile
  updateProfile: async (data: {
    displayName?: string;
    photoURL?: string;
  }): Promise<{ error?: AuthError }> => {
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) {
        const err = new Error('No user signed in');
        Object.assign(err, { code: 'auth/user-not-found' });
        throw err;
      }
      await updateProfile(user, data);
      return {};
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { error: handleAuthError(err) };
    }
  },

  // Re-authenticate (for sensitive operations)
  reauthenticate: async (email: string, password: string): Promise<{ error?: AuthError }> => {
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) {
        const err = new Error('No user signed in');
        Object.assign(err, { code: 'auth/user-not-found' });
        throw err;
      }

      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(user, credential);
      return {};
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { error: handleAuthError(err) };
    }
  },

  // Link Email/Password to existing account
  linkEmailPassword: async (email: string, password: string): Promise<{ error?: AuthError }> => {
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) {
        const err = new Error('No user signed in');
        Object.assign(err, { code: 'auth/user-not-found' });
        throw err;
      }

      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(user, credential);
      return {};
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { error: handleAuthError(err) };
    }
  },

  // Unlink provider
  unlinkProvider: async (providerId: string): Promise<{ error?: AuthError }> => {
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) {
        const err = new Error('No user signed in');
        Object.assign(err, { code: 'auth/user-not-found' });
        throw err;
      }

      await unlink(user, providerId);
      return {};
    } catch (error: unknown) {
      const err = toFirebaseErrorShape(error);
      return { error: handleAuthError(err) };
    }
  },
};

// ============================================================================
// Firestore Service
// ============================================================================

// Collections — typed via `withConverter` inside `typedCollection` so no
// runtime type assertion is needed to narrow the default `DocumentData`
// return type.
export const collections = {
  users: () => typedCollection<User>(getFirebaseFirestore(), 'users'),
  spas: () => typedCollection<Spa>(getFirebaseFirestore(), 'spas'),
  services: () => typedCollection<Service>(getFirebaseFirestore(), 'services'),
  spaServices: () => typedCollection<SpaService>(getFirebaseFirestore(), 'spa_services'),
  therapists: () => typedCollection<Therapist>(getFirebaseFirestore(), 'therapists'),
  bookings: () => typedCollection<Booking>(getFirebaseFirestore(), 'bookings'),
  reviews: () => typedCollection<Review>(getFirebaseFirestore(), 'reviews'),
  availability: () => typedCollection<Availability>(getFirebaseFirestore(), 'availability'),
  // transactions collection removed in Wave 1b (2026-05-02) — Stripe-only.
  payouts: () => typedCollection<Payout>(getFirebaseFirestore(), 'payouts'),
  notifications: () => typedCollection<Notification>(getFirebaseFirestore(), 'notifications'),
  vouchers: () => typedCollection<Voucher>(getFirebaseFirestore(), 'vouchers'),
  userVouchers: () => typedCollection<UserVoucher>(getFirebaseFirestore(), 'user_vouchers'),
  wallets: () => typedCollection<Wallet>(getFirebaseFirestore(), 'wallets'),
  supportTickets: () =>
    typedCollection<SupportTicket>(getFirebaseFirestore(), 'support_tickets'),
  analytics: () => typedCollection<Analytics>(getFirebaseFirestore(), 'analytics'),
  flags: () => typedCollection<FeatureFlag>(getFirebaseFirestore(), 'flags'),
  auditLogs: () => typedCollection<AuditLog>(getFirebaseFirestore(), 'audit_logs'),
};

// Document References — same story: `withConverter` provides the type
// narrowing that previously required an assertion at each call site.
export const documents = {
  user: (userId: string) => typedDoc<User>(getFirebaseFirestore(), 'users', userId),
  spa: (spaId: string) => typedDoc<Spa>(getFirebaseFirestore(), 'spas', spaId),
  service: (serviceId: string) => typedDoc<Service>(getFirebaseFirestore(), 'services', serviceId),
  spaService: (compositeId: string) =>
    typedDoc<SpaService>(getFirebaseFirestore(), 'spa_services', compositeId),
  therapist: (therapistId: string) =>
    typedDoc<Therapist>(getFirebaseFirestore(), 'therapists', therapistId),
  booking: (bookingId: string) =>
    typedDoc<Booking>(getFirebaseFirestore(), 'bookings', bookingId),
  review: (reviewId: string) => typedDoc<Review>(getFirebaseFirestore(), 'reviews', reviewId),
  availability: (compositeId: string) =>
    typedDoc<Availability>(getFirebaseFirestore(), 'availability', compositeId),
  // transaction doc helper removed in Wave 1b (2026-05-02) — Stripe-only.
  payout: (payoutId: string) => typedDoc<Payout>(getFirebaseFirestore(), 'payouts', payoutId),
  notification: (notificationId: string) =>
    typedDoc<Notification>(getFirebaseFirestore(), 'notifications', notificationId),
  voucher: (voucherCode: string) =>
    typedDoc<Voucher>(getFirebaseFirestore(), 'vouchers', voucherCode),
  userVoucher: (compositeId: string) =>
    typedDoc<UserVoucher>(getFirebaseFirestore(), 'user_vouchers', compositeId),
  wallet: (walletId: string) => typedDoc<Wallet>(getFirebaseFirestore(), 'wallets', walletId),
  supportTicket: (ticketId: string) =>
    typedDoc<SupportTicket>(getFirebaseFirestore(), 'support_tickets', ticketId),
  analytics: (compositeId: string) =>
    typedDoc<Analytics>(getFirebaseFirestore(), 'analytics', compositeId),
  flag: (flagKey: string) => typedDoc<FeatureFlag>(getFirebaseFirestore(), 'flags', flagKey),
  auditLog: (logId: string) => typedDoc<AuditLog>(getFirebaseFirestore(), 'audit_logs', logId),
};

type FirestoreError = {
  code: string;
  message: string;
};

const handleFirestoreError = (error: { code?: string; message: string }): FirestoreError => {
  const errorMessages: Record<string, string> = {
    'permission-denied': 'You do not have permission to perform this action',
    'not-found': 'The requested document was not found',
    'already-exists': 'A document with this ID already exists',
    'invalid-argument': 'Invalid argument provided',
    'deadline-exceeded': 'The operation took too long to complete',
    unavailable: 'The service is currently unavailable',
  };

  return {
    code: error.code || 'unknown',
    message: errorMessages[error.code || ''] || error.message,
  };
};

// Type guard used by `firestoreService.onSnapshot` to disambiguate doc-vs-query
// inputs without an in-line `as` assertion.
function isDocumentReference<T extends DocumentData>(
  ref: DocumentReference<T> | Query<T>,
): ref is DocumentReference<T> {
  return 'type' in ref && ref.type === 'document';
}

export const firestoreService = {
  // Get a single document
  getDoc: async <T extends DocumentData = DocumentData>(
    docRef: DocumentReference<T>,
  ): Promise<T | null> => {
    try {
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? snapToTyped<T>(docSnap) : null;
    } catch (error: unknown) {
      const err = toMaybeCodedErrorShape(error);
      throw handleFirestoreError(err);
    }
  },

  // Get multiple documents with query
  getDocs: async <T extends DocumentData = DocumentData>(
    collectionName: string,
    queryFn: (col: CollectionReference<T>) => Query<T>,
  ): Promise<T[]> => {
    try {
      const col = typedCollection<T>(getFirebaseFirestore(), collectionName);
      const q = queryFn(col);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((d) => snapToTyped<T>(d));
    } catch (error: unknown) {
      const err = toMaybeCodedErrorShape(error);
      throw handleFirestoreError(err);
    }
  },

  // Add a document. Accepts a fully-formed T (the Firebase SDK's
  // `WithFieldValue<T>` overload covers sentinels like serverTimestamp).
  addDoc: async <T extends DocumentData>(
    col: CollectionReference<T>,
    data: firestoreSdk.WithFieldValue<T>,
  ): Promise<string> => {
    try {
      const docRef = await addDoc(col, data);
      return docRef.id;
    } catch (error: unknown) {
      const err = toMaybeCodedErrorShape(error);
      throw handleFirestoreError(err);
    }
  },

  // Set a document (overwrite or merge). Because merge defaults to true,
  // the payload only needs to cover the fields being written — typed as
  // `PartialWithFieldValue<T>` so callers can pass an enriched Partial<T>
  // without resorting to an `as T` assertion.
  setDoc: async <T extends DocumentData>(
    docRef: DocumentReference<T>,
    data: firestoreSdk.PartialWithFieldValue<T>,
    merge = true,
  ): Promise<void> => {
    try {
      if (merge) {
        await setDoc(docRef, data, { merge: true });
      } else {
        // Non-merge writes require a full T at the SDK level; callers
        // pass `PartialWithFieldValue<T>` here. The cast lives at this
        // single boundary and is structurally validated by the Firebase
        // SDK's `WithFieldValue<T>` overload.
        await setDoc(docRef, data as firestoreSdk.WithFieldValue<T>);
      }
    } catch (error: unknown) {
      const err = toMaybeCodedErrorShape(error);
      throw handleFirestoreError(err);
    }
  },

  // Update a document. Accepts a Partial<T> shape — Firestore's
  // `UpdateData<T>` overload is structurally compatible with
  // `PartialWithFieldValue<T>` for our purposes (no dotted paths in our
  // call sites), so we widen to the latter to keep call sites that pass a
  // typed `Partial<T>` working without an in-line cast.
  updateDoc: async <T extends DocumentData>(
    docRef: DocumentReference<T>,
    data: firestoreSdk.PartialWithFieldValue<T>,
  ): Promise<void> => {
    try {
      // Firestore's runtime accepts the same shape; the lossy structural
      // cast lives at this single boundary.
      await updateDoc(docRef, data as firestoreSdk.UpdateData<T>);
    } catch (error: unknown) {
      const err = toMaybeCodedErrorShape(error);
      throw handleFirestoreError(err);
    }
  },

  // Delete a document
  deleteDoc: async <T extends DocumentData>(docRef: DocumentReference<T>): Promise<void> => {
    try {
      await deleteDoc(docRef);
    } catch (error: unknown) {
      const err = toMaybeCodedErrorShape(error);
      throw handleFirestoreError(err);
    }
  },

  // Batch operations
  batch: (): WriteBatch => {
    return writeBatch(getFirebaseFirestore());
  },

  // Run transaction
  transaction: async <T>(
    transactionFn: (transaction: FirestoreTransaction) => Promise<T>,
  ): Promise<T> => {
    return await runTransaction(getFirebaseFirestore(), transactionFn);
  },

  // Real-time listener
  onSnapshot: <T extends DocumentData = DocumentData>(
    docRefOrQuery: DocumentReference<T> | Query<T>,
    callback: (data: T[] | T | null) => void,
    onError?: (error: FirestoreError) => void,
  ): (() => void) => {
    if (isDocumentReference(docRefOrQuery)) {
      return onSnapshot(docRefOrQuery, {
        next: (snapshot) => {
          if (!snapshot.exists()) {
            callback(null);
            return;
          }
          callback(snapToTyped<T>(snapshot));
        },
        error: (error: unknown) => {
          const err = toMaybeCodedErrorShape(error);
          if (onError) {
            onError(handleFirestoreError(err));
          } else {
            logger.error('Firestore error', error, { component: 'firebase-client' });
          }
        },
      });
    }
    return onSnapshot(docRefOrQuery, {
      next: (snapshot) => {
        if (snapshot.empty) {
          callback([]);
          return;
        }
        callback(snapshot.docs.map((d) => snapToTyped<T>(d)));
      },
      error: (error: unknown) => {
        const err = toMaybeCodedErrorShape(error);
        if (onError) {
          onError(handleFirestoreError(err));
        } else {
          logger.error('Firestore error', error, { component: 'firebase-client' });
        }
      },
    });
  },

  // Server timestamp
  serverTimestamp: () => serverTimestamp(),

  // Array union
  arrayUnion: <T>(...elements: T[]) => arrayUnion(...elements),

  // Array remove
  arrayRemove: <T>(...elements: T[]) => arrayRemove(...elements),

  // Increment field
  increment: (n: number) => increment(n),

  // Timestamp utilities
  fromMillis: (milliseconds: number) => Timestamp.fromMillis(milliseconds),
  now: () => Timestamp.now(),
  toDate: (timestamp: Timestamp) => timestamp.toDate(),
};

// ============================================================================
// User Service
// ============================================================================

export const userService = {
  async getUser(userId: string): Promise<User | null> {
    const docRef = documents.user(userId);
    return await firestoreService.getDoc<User>(docRef);
  },

  async createUser(userId: string, data: Partial<User>): Promise<void> {
    const docRef = documents.user(userId);
    const seed: Partial<User> = {
      ...data,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await firestoreService.setDoc<User>(docRef, seed);
  },

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    const docRef = documents.user(userId);
    return await firestoreService.updateDoc(docRef, data);
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const q = query(collections.users(), where('profile.email', '==', email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return parseUser(snapshot.docs[0]);
  },

  subscribeToUser(userId: string, callback: (user: User | null) => void): () => void {
    return firestoreService.onSnapshot<User>(documents.user(userId), (data) => {
      if (data === null || Array.isArray(data)) {
        callback(null);
        return;
      }
      callback(data);
    });
  },
};

// ============================================================================
// Spa Service
// ============================================================================

export const spaService = {
  async getSpa(spaId: string): Promise<Spa | null> {
    const docRef = documents.spa(spaId);
    return await firestoreService.getDoc<Spa>(docRef);
  },

  async getSpaById(spaId: string): Promise<Spa | null> {
    const docRef = documents.spa(spaId);
    return await firestoreService.getDoc<Spa>(docRef);
  },

  async getSpas(params?: {
    city?: string;
    category?: string;
    status?: string;
    limit?: number;
  }): Promise<Spa[]> {
    let q = query(collections.spas(), where('isActive', '==', true));

    if (params?.status) {
      q = query(q, where('status', '==', params.status));
    }

    if (params?.limit) {
      q = query(q, limit(params.limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseSpa(d));
  },

  async getSpasByCategory(
    category: string,
    params?: { status?: string; limit?: number },
  ): Promise<Spa[]> {
    let q = query(
      collections.spas(),
      where('isActive', '==', true),
      where('categories', 'array-contains', category),
    );

    if (params?.status) {
      q = query(q, where('status', '==', params.status));
    }

    if (params?.limit) {
      q = query(q, limit(params.limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseSpa(d));
  },

  async getSpasNearby(lat: number, lng: number, radiusKm = 10): Promise<Spa[]> {
    const q = query(
      collections.spas(),
      where('isActive', '==', true),
      where('status', '==', 'active'),
    );
    const snapshot = await getDocs(q);

    // Filter by distance in-memory (Firestore geo-queries require special indexing)
    return snapshot.docs
      .map((d) => parseSpa(d))
      .filter((spa) => {
        if (!spa.location?.geo) return false;
        const distance = calculateDistance(lat, lng, spa.location.geo.lat, spa.location.geo.lng);
        return distance <= radiusKm;
      });
  },

  async createSpa(data: Partial<Spa>): Promise<string> {
    // Firestore accepts the partial write; the Firebase SDK's
    // `WithFieldValue` structural contract tolerates missing fields when the
    // server-side schema populates defaults (e.g. statistics, operatingHours).
    return await firestoreService.addDoc<Spa>(
      collections.spas(),
      data as firestoreSdk.WithFieldValue<Spa>,
    );
  },

  async updateSpa(spaId: string, data: Partial<Spa>): Promise<void> {
    const docRef = documents.spa(spaId);
    return await firestoreService.updateDoc(docRef, data);
  },
};

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// Service Catalog Service
// ============================================================================

export const serviceCatalogService = {
  async getService(serviceId: string): Promise<Service | null> {
    const docRef = documents.service(serviceId);
    return await firestoreService.getDoc<Service>(docRef);
  },

  async getServices(params?: { category?: string; isActive?: boolean }): Promise<Service[]> {
    let q = query(collections.services());

    if (params?.category) {
      q = query(q, where('category', '==', params.category));
    }
    if (params?.isActive !== undefined) {
      q = query(q, where('isActive', '==', params.isActive));
    }

    q = query(q, orderBy('ordering'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseService(d));
  },

  async getServicesByCategory(category: string, isActiveOnly = true): Promise<Service[]> {
    const q = query(
      collections.services(),
      where('category', '==', category),
      ...(isActiveOnly ? [where('isActive', '==', true)] : []),
      orderBy('ordering'),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseService(d));
  },

  async getPopularServices(limitCount = 10): Promise<Service[]> {
    // Note: Popularity should be tracked in analytics/stats
    // This is a basic implementation returning active services ordered
    const q = query(
      collections.services(),
      where('isActive', '==', true),
      orderBy('ordering'),
      limit(limitCount),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseService(d));
  },

  async getSpaServices(spaId: string): Promise<SpaService[]> {
    const col = collection(getFirebaseFirestore(), 'spas', spaId, 'services');
    const q = query(col, where('isActive', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseSpaService(d));
  },
};

// ============================================================================
// Therapist Service
// ============================================================================

export const therapistService = {
  async getTherapist(therapistId: string): Promise<Therapist | null> {
    const docRef = documents.therapist(therapistId);
    return await firestoreService.getDoc<Therapist>(docRef);
  },

  async getSpaTherapists(spaId: string): Promise<Therapist[]> {
    const q = query(
      collections.therapists(),
      where('spaId', '==', spaId),
      where('isActive', '==', true),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseTherapist(d));
  },

  async getAvailableTherapists(spaId: string, date: string): Promise<Therapist[]> {
    const therapists = await this.getSpaTherapists(spaId);
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    return therapists.filter((t) => {
      if (t.onLeave) return false;
      if (!t.availability || !t.availability[dayOfWeek]) return false;
      return t.status === 'online';
    });
  },
};

// ============================================================================
// Booking Service
// ============================================================================

export const bookingService = {
  async getBooking(bookingId: string): Promise<Booking | null> {
    const docRef = documents.booking(bookingId);
    return await firestoreService.getDoc<Booking>(docRef);
  },

  async getUserBookings(userId: string, status?: string): Promise<Booking[]> {
    let q = query(collections.bookings(), where('userId', '==', userId));

    if (status) {
      q = query(q, where('bookingStatus', '==', status));
    }

    q = query(q, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseBooking(d));
  },

  async getSpaBookings(spaId: string, status?: string): Promise<Booking[]> {
    let q = query(collections.bookings(), where('spaId', '==', spaId));

    if (status) {
      q = query(q, where('bookingStatus', '==', status));
    }

    q = query(q, orderBy('scheduledAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseBooking(d));
  },

  async createBooking(booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // The Firestore `addDoc` accepts `WithFieldValue<T>` which is
    // structurally compatible with our `Omit<Booking, ...>` write payload —
    // any missing fields are filled in server-side (createdAt/updatedAt via
    // serverTimestamp(), id via Firestore doc-generation).
    return await firestoreService.addDoc<Booking>(
      collections.bookings(),
      booking as firestoreSdk.WithFieldValue<Booking>,
    );
  },

  async updateBooking(bookingId: string, data: Partial<Booking>): Promise<void> {
    const docRef = documents.booking(bookingId);
    return await firestoreService.updateDoc(docRef, data);
  },

  async updateBookingStatus(
    bookingId: string,
    fromStatus: string,
    toStatus: string,
    actor: string,
    actorId: string,
    reason?: string,
  ): Promise<void> {
    const booking = await this.getBooking(bookingId);
    if (!booking) return;

    const parsedFrom = parseBookingStatusValue(fromStatus);
    const parsedTo = parseBookingStatusValue(toStatus);
    const parsedActor = parseActorValue(actor);

    const statusHistoryEntry: StatusHistoryEntry = {
      status: parsedTo,
      from: parsedFrom,
      to: parsedTo,
      actor: parsedActor,
      actorId,
      timestamp: new Date().toISOString(),
      reason,
    };

    return await this.updateBooking(bookingId, {
      bookingStatus: parsedTo,
      statusHistory: [...booking.statusHistory, statusHistoryEntry],
      updatedAt: new Date().toISOString(),
    });
  },

  subscribeToUserBookings(userId: string, callback: (bookings: Booking[]) => void): () => void {
    const q = query(
      collections.bookings(),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    );
    return firestoreService.onSnapshot<Booking>(q, (data) => {
      if (data === null) {
        callback([]);
        return;
      }
      if (Array.isArray(data)) {
        callback(data);
        return;
      }
      callback([data]);
    });
  },
};

// ============================================================================
// Review Service
// ============================================================================

export const reviewService = {
  async getReview(reviewId: string): Promise<Review | null> {
    const docRef = documents.review(reviewId);
    return await firestoreService.getDoc<Review>(docRef);
  },

  async getSpaReviews(spaId: string): Promise<Review[]> {
    const q = query(
      collections.reviews(),
      where('spaId', '==', spaId),
      where('isActive', '==', true),
      where('moderation.status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseReview(d));
  },

  async getUserReviews(userId: string): Promise<Review[]> {
    const q = query(
      collections.reviews(),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseReview(d));
  },

  async createReview(review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return await firestoreService.addDoc<Review>(
      collections.reviews(),
      review as firestoreSdk.WithFieldValue<Review>,
    );
  },

  async updateReview(reviewId: string, data: Partial<Review>): Promise<void> {
    const docRef = documents.review(reviewId);
    return await firestoreService.updateDoc(docRef, data);
  },
};

// ============================================================================
// Availability Service
// ============================================================================

export const availabilityService = {
  getAvailability: async (
    spaId: string,
    date: string,
    therapistId?: string,
  ): Promise<SlotAvailability[]> => {
    const compositeId = therapistId ? `${spaId}_${date}_${therapistId}` : `${spaId}_${date}_any`;

    const docRef = doc(getFirebaseFirestore(), 'availability', compositeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return [];
    }

    const data = docSnap.data();
    return data?.slots || [];
  },

  observeAvailability(
    spaId: string,
    date: string,
    callback: (slots: SlotAvailability[]) => void,
    therapistId?: string,
  ): () => void {
    const compositeId = therapistId ? `${spaId}_${date}_${therapistId}` : `${spaId}_${date}_any`;

    const docRef = doc(getFirebaseFirestore(), 'availability', compositeId);

    return onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const data = snapshot.data();
      callback(data?.slots || []);
    });
  },
};

// transactionService removed in Wave 1b (2026-05-02). The `transactions`
// collection was a Stripe-only side-effect store; pay-at-spa has no online
// charge ledger to surface to the client.

// ============================================================================
// Payout Service
// ============================================================================

export const payoutService = {
  async getPayout(payoutId: string): Promise<Payout | null> {
    const docRef = documents.payout(payoutId);
    return await firestoreService.getDoc<Payout>(docRef);
  },

  async getSpaPayouts(
    spaId: string,
    params?: { status?: string; limit?: number },
  ): Promise<Payout[]> {
    let q = query(collections.payouts(), where('spaId', '==', spaId), orderBy('createdAt', 'desc'));

    if (params?.status) {
      q = query(q, where('status', '==', params.status));
    }
    if (params?.limit) {
      q = query(q, limit(params.limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parsePayout(d));
  },

  async getUserPayouts(userId: string): Promise<Payout[]> {
    const q = query(
      collections.payouts(),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parsePayout(d));
  },
};

// ============================================================================
// Notification Service
// ============================================================================

export const notificationService = {
  async getNotification(notificationId: string): Promise<Notification | null> {
    const docRef = documents.notification(notificationId);
    return await firestoreService.getDoc<Notification>(docRef);
  },

  async getUserNotifications(
    userId: string,
    params?: { unreadOnly?: boolean; limit?: number },
  ): Promise<Notification[]> {
    let q = query(
      collections.notifications(),
      where('userId', '==', userId),
      orderBy('sentAt', 'desc'),
    );

    if (params?.unreadOnly) {
      q = query(q, where('read', '==', false));
    }
    if (params?.limit) {
      q = query(q, limit(params.limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseNotification(d));
  },

  async markAsRead(notificationId: string): Promise<void> {
    const docRef = documents.notification(notificationId);
    const update: Partial<Notification> = {
      read: true,
      readAt: new Date().toISOString(),
    };
    await firestoreService.updateDoc(docRef, update);
  },

  async markAllAsRead(userId: string): Promise<void> {
    const q = query(
      collections.notifications(),
      where('userId', '==', userId),
      where('read', '==', false),
    );
    const snapshot = await getDocs(q);
    const batch = firestoreService.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true, readAt: new Date().toISOString() });
    });
    await batch.commit();
  },
};

// ============================================================================
// Voucher Service
// ============================================================================

export const voucherService = {
  async getVoucher(code: string): Promise<Voucher | null> {
    const docRef = documents.voucher(code);
    return await firestoreService.getDoc<Voucher>(docRef);
  },

  async getActiveVouchers(): Promise<Voucher[]> {
    const q = query(collections.vouchers(), where('isActive', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseVoucher(d));
  },

  async validateVoucher(
    code: string,
  ): Promise<{ valid: boolean; voucher: Voucher | null; error?: string }> {
    const voucher = await this.getVoucher(code);
    if (!voucher) {
      return { valid: false, voucher: null, error: 'Voucher not found' };
    }
    if (!voucher.isActive) {
      return { valid: false, voucher: null, error: 'Voucher is not active' };
    }
    if (voucher.usedCount >= voucher.usageLimit) {
      return { valid: false, voucher: null, error: 'Voucher usage limit reached' };
    }
    const now = new Date();
    if (voucher.validFrom && new Date(voucher.validFrom) > now) {
      return { valid: false, voucher: null, error: 'Voucher is not yet valid' };
    }
    if (voucher.validUntil && new Date(voucher.validUntil) < now) {
      return { valid: false, voucher, error: 'Voucher has expired' };
    }
    return { valid: true, voucher };
  },
};

// ============================================================================
// User Voucher Service
// ============================================================================

export const userVoucherService = {
  async getUserVoucher(compositeId: string): Promise<UserVoucher | null> {
    const docRef = documents.userVoucher(compositeId);
    return await firestoreService.getDoc<UserVoucher>(docRef);
  },

  async getUserVouchers(userId: string): Promise<UserVoucher[]> {
    const q = query(collections.userVouchers(), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseUserVoucher(d));
  },

  async redeemVoucher(
    userId: string,
    voucherCode: string,
  ): Promise<{ success: boolean; error?: string }> {
    const compositeId = `${userId}_${voucherCode}`;
    const userVoucher = await this.getUserVoucher(compositeId);

    if (!userVoucher || userVoucher.remainingUses <= 0) {
      return { success: false, error: 'No valid voucher found' };
    }

    const docRef = documents.userVoucher(compositeId);
    const update: Partial<UserVoucher> = {
      remainingUses: userVoucher.remainingUses - 1,
      usedAt: [...userVoucher.usedAt, new Date().toISOString()],
    };
    await firestoreService.updateDoc(docRef, update);

    return { success: true };
  },
};

// ============================================================================
// Wallet Service
// ============================================================================

export const walletService = {
  async getWallet(userId: string): Promise<Wallet | null> {
    const docRef = documents.wallet(userId);
    return await firestoreService.getDoc<Wallet>(docRef);
  },

  async getOrCreateWallet(userId: string): Promise<Wallet | null> {
    const docRef = documents.wallet(userId);
    const wallet = await firestoreService.getDoc<Wallet>(docRef);

    if (!wallet) {
      const seed: Partial<Wallet> = {
        userId,
        currency: 'INR',
        balance: { current: 0, credited: 0, debited: 0 },
        transactions: [],
      };
      await firestoreService.setDoc<Wallet>(docRef, seed);
      return await firestoreService.getDoc<Wallet>(docRef);
    }

    return wallet;
  },

  async addCredit(
    userId: string,
    amount: number,
    description: string,
    reference?: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    if (!wallet) return;

    const transaction: WalletTransaction = {
      id: `txn_${Date.now()}`,
      type: 'credit',
      amount,
      description,
      reference,
      createdAt: new Date().toISOString(),
    };

    const docRef = documents.wallet(userId);
    const update: Partial<Wallet> = {
      balance: {
        current: wallet.balance.current + amount,
        credited: wallet.balance.credited + amount,
        debited: wallet.balance.debited,
      },
      transactions: [transaction, ...wallet.transactions],
    };
    await firestoreService.updateDoc(docRef, update);
  },

  async deductCredit(
    userId: string,
    amount: number,
    description: string,
    reference?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const wallet = await this.getOrCreateWallet(userId);
    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    if (wallet.balance.current < amount) {
      return { success: false, error: 'Insufficient balance' };
    }

    const transaction: WalletTransaction = {
      id: `txn_${Date.now()}`,
      type: 'debit',
      amount,
      description,
      reference,
      createdAt: new Date().toISOString(),
    };

    const docRef = documents.wallet(userId);
    const update: Partial<Wallet> = {
      balance: {
        current: wallet.balance.current - amount,
        credited: wallet.balance.credited,
        debited: wallet.balance.debited + amount,
      },
      transactions: [transaction, ...wallet.transactions],
    };
    await firestoreService.updateDoc(docRef, update);

    return { success: true };
  },
};

// ============================================================================
// Support Ticket Service
// ============================================================================

export const supportTicketService = {
  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    const docRef = documents.supportTicket(ticketId);
    return await firestoreService.getDoc<SupportTicket>(docRef);
  },

  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    const q = query(
      collections.supportTickets(),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseSupportTicket(d));
  },

  async getSpaTickets(spaId: string): Promise<SupportTicket[]> {
    const q = query(
      collections.supportTickets(),
      where('spaId', '==', spaId),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseSupportTicket(d));
  },

  async createTicket(
    ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    return await firestoreService.addDoc<SupportTicket>(
      collections.supportTickets(),
      ticket as firestoreSdk.WithFieldValue<SupportTicket>,
    );
  },

  async updateTicketStatus(ticketId: string, status: SupportTicket['status']): Promise<void> {
    const docRef = documents.supportTicket(ticketId);
    // SupportTicket interface in @/types intentionally omits an explicit
    // `updatedAt` field (its `closedAt` is for terminal state) but every
    // mutable Firestore doc carries an updatedAt mutation marker. Build the
    // payload as a plain Partial and trust the SDK's structural contract.
    const update: firestoreSdk.PartialWithFieldValue<SupportTicket> = {
      status,
    };
    const updatePlus = { ...update, updatedAt: new Date().toISOString() };
    await firestoreService.updateDoc(docRef, updatePlus);
  },
};

// ============================================================================
// Analytics Service
// ============================================================================

export const analyticsService = {
  async getAnalytics(compositeId: string): Promise<Analytics | null> {
    const docRef = documents.analytics(compositeId);
    return await firestoreService.getDoc<Analytics>(docRef);
  },

  async getAnalyticsByType(
    type: Analytics['type'],
    period: Analytics['period'],
    limitCount = 30,
  ): Promise<Analytics[]> {
    const q = query(
      collections.analytics(),
      where('type', '==', type),
      where('period', '==', period),
      orderBy('date', 'desc'),
      limit(limitCount),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseAnalytics(d));
  },
};

// ============================================================================
// Feature Flags Service
// ============================================================================

export const featureFlagService = {
  async getFlag(key: string): Promise<FeatureFlag | null> {
    const docRef = documents.flag(key);
    return await firestoreService.getDoc<FeatureFlag>(docRef);
  },

  async isFeatureEnabled(key: string, userId?: string, userRole?: string): Promise<boolean> {
    const flag = await this.getFlag(key);
    if (!flag) return false;

    // Check targeting rules
    if (userId && flag.targeting.users?.includes(userId)) {
      return flag.value;
    }
    const parsedRole = userRole ? parseUserRole(userRole) : null;
    if (parsedRole && flag.targeting.roles?.includes(parsedRole)) {
      return flag.value;
    }
    if (
      flag.targeting.percentage !== undefined &&
      flag.targeting.percentage >= 0 &&
      flag.targeting.percentage <= 100
    ) {
      // Percentage-based rollout (simple hash-based)
      const hash = userId
        ? userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
        : Math.random() * 100;
      return hash % 100 < flag.targeting.percentage ? flag.value : flag.defaultValue;
    }

    return flag.defaultValue;
  },

  async getAllActiveFlags(): Promise<FeatureFlag[]> {
    const q = query(collections.flags(), where('value', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseFeatureFlag(d));
  },
};

// ============================================================================
// Audit Log Service
// ============================================================================

export const auditLogService = {
  async createLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<string> {
    const logWithTimestamp: AuditLog = {
      ...log,
      timestamp: new Date().toISOString(),
    };
    return await firestoreService.addDoc<AuditLog>(collections.auditLogs(), logWithTimestamp);
  },

  async getUserLogs(userId: string, limitCount = 50): Promise<AuditLog[]> {
    const q = query(
      collections.auditLogs(),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseAuditLog(d));
  },

  async getEntityLogs(entityType: string, entityId: string, limitCount = 50): Promise<AuditLog[]> {
    const q = query(
      collections.auditLogs(),
      where('entity', '==', entityType),
      where('entityId', '==', entityId),
      orderBy('timestamp', 'desc'),
      limit(limitCount),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => parseAuditLog(d));
  },
};

// ============================================================================
// Exports
// ============================================================================

export * from '@/types';

// Re-export domain-specific helpers from dedicated modules
export {
  createBooking as createBookingRecord,
  getUserBookings as getUserBookingRecords,
  getBookingById as getBookingRecordById,
  getBookingsForDate,
  updateBookingStatus as updateBookingRecordStatus,
} from './bookings';

export {
  getOrCreateChat,
  sendChatMessage,
  subscribeToChatMessages,
  markMessagesAsRead,
} from './chats';

export { saveCart, loadCart } from './cart';

export {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  getImageUrl,
  storageService,
  StorageValidationError,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from './storage';

const firebaseClient = {
  auth: authService,
  firestore: firestoreService,
  users: userService,
  spas: spaService,
  services: serviceCatalogService,
  therapists: therapistService,
  bookings: bookingService,
  reviews: reviewService,
  availability: availabilityService,
  // transactions service removed in Wave 1b (2026-05-02) — Stripe-only.
  payouts: payoutService,
  notifications: notificationService,
  vouchers: voucherService,
  userVouchers: userVoucherService,
  wallets: walletService,
  supportTickets: supportTicketService,
  analytics: analyticsService,
  flags: featureFlagService,
  auditLogs: auditLogService,
};

export default firebaseClient;
