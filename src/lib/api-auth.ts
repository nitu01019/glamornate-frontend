import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export interface AuthSuccess {
  user: DecodedIdToken;
  uid: string;
}

export interface AuthResult {
  success: boolean;
  user?: DecodedIdToken;
  uid?: string;
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

export class AuthError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }

  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

function extractBearerToken(request: NextRequest): string {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    throw new AuthError(
      'UNAUTHORIZED',
      'Missing Authorization header. Provide a Bearer token.',
      401,
    );
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthError(
      'UNAUTHORIZED',
      'Invalid Authorization header format. Expected "Bearer <token>".',
      401,
    );
  }

  const token = parts[1];

  if (!token || token.length === 0) {
    throw new AuthError('UNAUTHORIZED', 'Empty Bearer token.', 401);
  }

  return token;
}

/**
 * Authenticate an API request using Firebase ID token verification.
 * Returns the decoded token and UID on success.
 * Throws AuthError with code UNAUTHORIZED on failure.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthSuccess> {
  const token = extractBearerToken(request);

  try {
    const auth = getAuth();
    // checkRevoked: true ensures revoked/disabled tokens are rejected server-side
    const decodedToken = await auth.verifyIdToken(token, true);

    return {
      user: decodedToken,
      uid: decodedToken.uid,
    };
  } catch (error: unknown) {
    const message = getFirebaseAuthErrorMessage(error);
    throw new AuthError('UNAUTHORIZED', message, 401);
  }
}

/**
 * Safe version of authenticateRequest that returns a result object
 * instead of throwing errors. Useful for optional authentication.
 */
export async function authenticateRequestSafe(request: NextRequest): Promise<AuthResult> {
  try {
    const { user, uid } = await authenticateRequest(request);
    return { success: true, user, uid };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          status: error.status,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
        status: 401,
      },
    };
  }
}

/**
 * Authenticate a request and verify the user has one of the allowed roles.
 * Looks up the user's Firestore document to retrieve their role.
 * Throws AuthError with code FORBIDDEN if the user lacks the required role.
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[],
): Promise<AuthSuccess> {
  const { user, uid } = await authenticateRequest(request);

  const adminDb = getAdminDb();

  if (!adminDb) {
    throw new AuthError('INTERNAL_ERROR', 'Database connection failed', 500);
  }

  const userDoc = await adminDb.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new AuthError('FORBIDDEN', 'User profile not found', 403);
  }

  const userData = userDoc.data();
  const userRole = userData?.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new AuthError('FORBIDDEN', 'Access denied', 403);
  }

  return { user, uid };
}

function getFirebaseAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;

    switch (code) {
      case 'auth/id-token-expired':
        return 'Token has expired. Please sign in again.';
      case 'auth/id-token-revoked':
        return 'Token has been revoked. Please sign in again.';
      case 'auth/invalid-id-token':
        return 'Invalid authentication token.';
      case 'auth/argument-error':
        return 'Malformed authentication token.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      default:
        return 'Authentication failed.';
    }
  }

  return 'Authentication failed.';
}
