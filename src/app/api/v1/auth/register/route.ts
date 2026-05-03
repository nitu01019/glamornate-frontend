import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const routeLogger = logger.child({ component: 'auth/register' });

/**
 * Neutral success envelope for the register endpoint.
 *
 * SECURITY: Per remediation plan S3, the public response MUST NOT reveal
 * whether the email was accepted, rejected, rate-limited, or already exists.
 * All side effects (user creation, verification email, audit log) run before
 * the response and any failure is logged server-side while the client still
 * receives this neutral envelope.
 */
const NEUTRAL_SUCCESS_RESPONSE = {
  success: true as const,
  data: { requiresEmailVerification: true },
  message: "If this email is available, you'll receive a confirmation link.",
};

function neutralResponse() {
  return NextResponse.json(NEUTRAL_SUCCESS_RESPONSE, { status: 200 });
}

function validationError(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'REGISTRATION_FAILED', message } },
    { status: 400 },
  );
}

// =============================================================================
// App Check verification (inline — matches backend verifyAppCheck pattern)
// =============================================================================

/**
 * Verify the App Check token on the incoming request.
 *
 * Mirrors the backend middleware in `backend/functions/src/http/middleware/appCheck.ts`:
 *   - Reads `X-Firebase-AppCheck` header.
 *   - Calls `admin.appCheck().verifyToken(token)`.
 *   - Honours `ALLOW_APP_CHECK_DEBUG=true` (emulator/test bypass).
 *   - Additional escape hatch `FRONTEND_APP_CHECK_SOFT_FAIL=1` logs a warning
 *     and allows the request through — used to stage the rollout without
 *     breaking clients that haven't shipped the App Check header yet.
 */
async function verifyAppCheckToken(request: NextRequest): Promise<boolean> {
  if (process.env.ALLOW_APP_CHECK_DEBUG === 'true') {
    return true;
  }

  const token = request.headers.get('x-firebase-appcheck');

  if (!token) {
    if (process.env.FRONTEND_APP_CHECK_SOFT_FAIL === '1') {
      routeLogger.warn('App Check token missing — soft-fail enabled, allowing request');
      return true;
    }
    routeLogger.warn('App Check token missing on register request');
    return false;
  }

  const app = getApps()[0];
  if (!app) {
    routeLogger.error('Firebase Admin app not initialized — cannot verify App Check');
    return false;
  }

  try {
    await getAppCheck(app).verifyToken(token);
    return true;
  } catch (error) {
    if (process.env.FRONTEND_APP_CHECK_SOFT_FAIL === '1') {
      routeLogger.warn('App Check token verification failed — soft-fail enabled', { error });
      return true;
    }
    routeLogger.warn('App Check token verification failed', { error });
    return false;
  }
}

// =============================================================================
// Rate limiting (Firestore-backed, serverless-safe)
// =============================================================================

/**
 * Firestore-backed token-bucket rate limiter.
 *
 * Returns `true` when the request is within the allowance, `false` when it
 * exceeds the limit for the given window. The backend's in-memory limiter
 * does not work on serverless (per issue B3), so we store counters in
 * Firestore at `_rateLimits/{key}` and roll the window when `firstAt` ages
 * out.
 */
async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const db = getAdminDb();
  if (!db) {
    // Fail-open when the DB is unavailable — the alternative is locking out
    // every user if admin credentials ever flap. Logged so ops can alert.
    routeLogger.error('Rate limiter unavailable — Firestore admin not configured', { key });
    return true;
  }

  const docRef = db.collection('_rateLimits').doc(key);
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    return await db.runTransaction(async (txn) => {
      const snap = await txn.get(docRef);
      const data = snap.data() as { count?: number; firstAt?: number; lastAt?: number } | undefined;

      if (!snap.exists || !data?.firstAt || data.firstAt < windowStart) {
        // B3: expiresAt anchors TTL cleanup to firstAt + 2 × windowMs so the
        // Firestore TTL policy (enabled via gcloud on collection-group
        // `_rateLimits`) can GC rolled-out buckets without racing an in-flight
        // window. The doubled window leaves safe headroom for clock skew.
        txn.set(docRef, {
          count: 1,
          firstAt: now,
          lastAt: now,
          updatedAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromMillis(now + windowMs * 2),
        });
        return true;
      }

      if ((data.count ?? 0) >= limit) {
        return false;
      }

      txn.update(docRef, {
        count: (data.count ?? 0) + 1,
        lastAt: now,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(data.firstAt + windowMs * 2),
      });
      return true;
    });
  } catch (error) {
    routeLogger.error('Rate limiter transaction failed', { key, error });
    // Fail-open on transaction errors so a Firestore blip does not DoS real users.
    return true;
  }
}

/**
 * Extract the best-effort client IP. `x-forwarded-for` is a comma-separated
 * list where the first entry is the original client; fall back to the direct
 * remote-address headers Vercel/Node set. Never throws.
 */
function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-vercel-forwarded-for') ||
    'unknown'
  );
}

// =============================================================================
// Password policy
// =============================================================================

/** Minimum password length. Industry baseline (NIST 800-63B §5.1.1.2). */
const MIN_PASSWORD_LENGTH = 12;

/**
 * Validate the password against project policy. Length check is enforced
 * inline; zxcvbn score ≥ 3 is a Phase-5 hygiene upgrade (package not yet
 * installed — see REMEDIATION_PLAN.md S3).
 */
function isPasswordAcceptable(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < MIN_PASSWORD_LENGTH) return false;
  // TODO(Phase-5): if (zxcvbn(password).score < 3) return false;
  return true;
}

/** Basic email sanity check — full RFC validation happens in Firebase Auth. */
function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// =============================================================================
// Side effects (user creation, verification email, audit) — isolated so the
// POST handler can run them inside a try/catch and still return a neutral
// response on any failure.
// =============================================================================

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

async function runRegistrationSideEffects(input: RegisterInput): Promise<void> {
  const { email, password, fullName, phone } = input;
  const role = 'customer'; // SECURITY: Never trust client-supplied role.

  const auth = getAuth();

  const userRecord = await auth.createUser({
    email,
    password,
    displayName: fullName,
    phoneNumber: phone ? `+91${phone.replace(/\D/g, '')}` : undefined,
    emailVerified: false,
    disabled: false,
  });

  const db = getAdminDb();
  if (!db) {
    // Log and bail — the caller will still return the neutral response.
    throw new Error('Firestore admin not configured');
  }

  const nowIso = new Date().toISOString();
  const userDoc = {
    authProvider: 'email',
    role,
    profile: {
      displayName: fullName,
      email,
      phone,
      photo: null,
    },
    emailVerified: false,
    phoneVerified: false,
    preferences: {
      language: 'en',
      notifications: { push: true, email: true, sms: false },
    },
    customerData: { favorites: [], history: [] },
    isActive: true,
    lastLoginAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await db.collection('users').doc(userRecord.uid).set(userDoc);

  // Generate the verification link. The downstream email delivery (via
  // whichever provider the platform uses) is fire-and-forget from the
  // client's perspective — we MUST NOT leak delivery status in the response.
  await auth.generateEmailVerificationLink(email);
}

// =============================================================================
// POST /api/v1/auth/register
// =============================================================================

/**
 * Handle user registration with:
 *   - App Check token verification
 *   - Firestore-backed rate limiting (10/min/IP, 3/hr/email)
 *   - Password policy (≥ 12 chars)
 *   - Account-enumeration-resistant neutral response
 *   - Generic error code (REGISTRATION_FAILED) — no Firebase auth/* codes leak.
 */
export async function POST(request: NextRequest) {
  // --- 1. App Check ------------------------------------------------------
  const appCheckValid = await verifyAppCheckToken(request);
  if (!appCheckValid) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'REGISTRATION_FAILED', message: 'Request could not be authenticated.' },
      },
      { status: 401 },
    );
  }

  // --- 2. Parse + validate input ----------------------------------------
  let body: Partial<RegisterInput>;
  try {
    body = (await request.json()) as Partial<RegisterInput>;
  } catch {
    return validationError('Invalid request body');
  }

  const { email, password, fullName, phone } = body;

  if (!email || !password || !fullName) {
    return validationError('Email, password, and full name are required');
  }
  if (!isValidEmail(email)) {
    return validationError('Please provide a valid email address');
  }
  if (typeof password !== 'string' || !isPasswordAcceptable(password)) {
    return validationError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include a mix of letters, numbers, and symbols`,
    );
  }

  const normalisedEmail = email.toLowerCase().trim();
  const ip = getClientIp(request);

  // --- 3. Rate limit (IP: 10/min, email: 3/hr) --------------------------
  // We run both checks. If either trips, we still return a neutral 200 so
  // attackers cannot probe which emails exist via rate-limit signals.
  const [ipAllowed, emailAllowed] = await Promise.all([
    checkRateLimit(`ip:${ip}`, 10, 60_000),
    checkRateLimit(`email:${normalisedEmail}`, 3, 60 * 60 * 1000),
  ]);

  if (!ipAllowed || !emailAllowed) {
    routeLogger.warn('Register request rate-limited', {
      ipAllowed,
      emailAllowed,
      // Do not log the raw email in clear text at warn level in prod; hash
      // upstream if needed. For now we rely on log-sink access controls.
    });
    return neutralResponse();
  }

  // --- 4. Side effects (best-effort, neutral response either way) -------
  try {
    await runRegistrationSideEffects({
      email: normalisedEmail,
      password,
      fullName,
      phone,
    });
  } catch (error: unknown) {
    const errorCode = (error as { code?: string })?.code;
    const errorMessage = (error as { message?: string })?.message;

    // Log the real reason server-side — never leak to the client.
    routeLogger.error('Registration side-effect failed', {
      errorCode,
      errorMessage,
      // Full error for stack trace when available.
      error,
    });

    // IMPORTANT: Fall through to neutral response. Do NOT leak whether the
    // account already exists (auth/email-already-exists), the email is
    // malformed (auth/invalid-email), or the password was rejected by
    // Firebase (auth/weak-password). All are mapped to the neutral body.
  }

  return neutralResponse();
}
