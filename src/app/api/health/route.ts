import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

interface DependencyStatus {
  status: 'ok' | 'degraded' | 'unavailable';
  latencyMs?: number;
  error?: string;
}

/**
 * Perform a lightweight Firestore connectivity check.
 * Attempts to read a single document from a known collection.
 */
async function checkFirebase(): Promise<DependencyStatus> {
  const start = Date.now();

  try {
    const adminDb = getAdminDb();

    if (!adminDb) {
      return {
        status: 'unavailable',
        error: 'Firebase Admin not configured (missing FIREBASE_ADMIN_* env vars)',
      };
    }

    // Lightweight read: fetch one document from spas collection (limit 1)
    await adminDb.collection('spas').limit(1).get();

    return {
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Firebase error';
    return {
      status: 'degraded',
      latencyMs: Date.now() - start,
      error: message,
    };
  }
}

export async function GET() {
  const startTime = Date.now();

  const firebase = await checkFirebase();

  const overallStatus =
    firebase.status === 'ok' ? 'ok' : firebase.status === 'degraded' ? 'degraded' : 'unavailable';

  const httpStatus = overallStatus === 'ok' ? 200 : 503;

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTimeMs: Date.now() - startTime,
    dependencies: {
      firebase,
    },
  };

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Type': 'application/json',
    },
  });
}

// Also support HEAD requests for lightweight health checks
export async function HEAD() {
  const firebase = await checkFirebase();
  const httpStatus = firebase.status === 'ok' ? 200 : 503;

  return new NextResponse(null, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
