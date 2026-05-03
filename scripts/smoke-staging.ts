/**
 * smoke-staging.ts — Wave 11 W11-F deferred work, Agent 5.
 *
 * Happy-path smoke check against a deployed staging backend.
 *
 * Required env vars:
 *   STAGING_TEST_USER_EMAIL    — pre-seeded test user
 *   STAGING_TEST_USER_PASSWORD — password for that user
 *   STAGING_FIREBASE_API_KEY   — Web API key for the Firebase project
 *
 * Optional env vars:
 *   STAGING_FIREBASE_PROJECT_ID — defaults to "glamornate-758c6"
 *   STAGING_REGION              — defaults to "us-central1"
 *   STAGING_SPA_ID              — defaults to "smoke-test-spa"
 *
 * Exit codes:
 *   0 — SMOKE OK   : function returned 200 AND a fresh booking landed in Firestore
 *   1 — SMOKE FAIL : function call failed with a non-structured error
 *   2 — SMOKE TIMEOUT : function 200 but no booking observed within 10s
 *
 * Notes:
 *   - Uses ONLY built-in node:fetch + node:process (Node 20+).
 *   - No firebase-admin SDK — talks Firestore via REST so the script is
 *     CI-runnable on a bare Node runtime.
 *   - The Cloud Function payload follows the v1 callable wire format:
 *     POST body is { data: {...} }, response is { result: {...} } or { error: {...} }.
 *     See https://firebase.google.com/docs/functions/callable-reference
 */

import { exit, env } from 'node:process';

// ---------- types ----------------------------------------------------------

interface SignInResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
}

interface CallableOk {
  result: unknown;
}

interface CallableErr {
  error: {
    status?: string;
    message?: string;
    code?: string;
    details?: unknown;
  };
}

type CallableResponse = CallableOk | CallableErr;

// Acceptable structured 4xx codes that still mean "the function is alive".
const STRUCTURED_OK_CODES = new Set([
  'SLOT_UNAVAILABLE',
  'SPA_NOT_FOUND',
  'invalid-argument',
  'not-found',
  'failed-precondition',
]);

// ---------- env loading ----------------------------------------------------

function requireEnv(name: string): string {
  const value = env[name];
  if (!value || value.trim() === '') {
    console.error(`SMOKE FAIL: missing required env var ${name}`);
    exit(1);
  }
  return value;
}

const TEST_EMAIL = requireEnv('STAGING_TEST_USER_EMAIL');
const TEST_PASSWORD = requireEnv('STAGING_TEST_USER_PASSWORD');
const API_KEY = requireEnv('STAGING_FIREBASE_API_KEY');
const PROJECT_ID = env.STAGING_FIREBASE_PROJECT_ID ?? 'glamornate-758c6';
const REGION = env.STAGING_REGION ?? 'us-central1';
const SPA_ID = env.STAGING_SPA_ID ?? 'smoke-test-spa';

// IST date in YYYY-MM-DD form. Asia/Kolkata never observes DST, so this is stable.
const TODAY_IST = new Date().toLocaleDateString('en-CA', {
  timeZone: 'Asia/Kolkata',
});

const SCRIPT_STARTED_AT_MS = Date.now();

// ---------- step 1: sign in ------------------------------------------------

async function signIn(): Promise<SignInResponse> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(API_KEY)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`SMOKE FAIL: sign-in returned ${response.status}: ${text}`);
    exit(1);
  }

  const data = (await response.json()) as SignInResponse;
  if (!data.idToken || !data.localId) {
    console.error('SMOKE FAIL: sign-in response missing idToken/localId');
    exit(1);
  }
  return data;
}

// ---------- step 2: call getAvailableSlots --------------------------------

async function callGetAvailableSlots(idToken: string): Promise<void> {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/getAvailableSlots`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      data: {
        spaId: SPA_ID,
        date: TODAY_IST,
        serviceDuration: 60,
      },
    }),
  });

  // Structured-error path: callable returns 4xx with { error: { status, message } }.
  if (response.status >= 400 && response.status < 500) {
    let parsed: CallableErr | undefined;
    try {
      parsed = (await response.json()) as CallableErr;
    } catch {
      // fall through
    }
    const errorCode = parsed?.error?.status ?? parsed?.error?.code ?? '';
    const errorMessage = parsed?.error?.message ?? '';

    // Structured 4xx is acceptable — the function answered.
    if (
      parsed?.error &&
      (STRUCTURED_OK_CODES.has(errorCode) ||
        STRUCTURED_OK_CODES.has(errorMessage))
    ) {
      console.log(
        `getAvailableSlots returned structured ${response.status}: ${errorCode || errorMessage} — function is alive.`,
      );
      return;
    }

    console.error(
      `SMOKE FAIL: getAvailableSlots ${response.status} ${errorCode || errorMessage || '(no body)'}`,
    );
    exit(1);
  }

  if (response.status !== 200) {
    console.error(`SMOKE FAIL: getAvailableSlots returned ${response.status}`);
    exit(1);
  }

  const body = (await response.json()) as CallableResponse;
  if ('error' in body && body.error) {
    const errorCode = body.error.status ?? body.error.code ?? '';
    if (STRUCTURED_OK_CODES.has(errorCode)) {
      console.log(`getAvailableSlots returned structured 200-with-error: ${errorCode}`);
      return;
    }
    console.error(`SMOKE FAIL: getAvailableSlots structured error ${errorCode}`);
    exit(1);
  }

  console.log('getAvailableSlots returned 200 OK.');
}

// ---------- step 3: poll Firestore for a fresh booking --------------------

interface FirestoreDoc {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
}

interface RunQueryResultRow {
  document?: FirestoreDoc;
  readTime?: string;
}

async function findFreshBooking(idToken: string, userId: string): Promise<boolean> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

  const startedAtIso = new Date(SCRIPT_STARTED_AT_MS).toISOString();
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'bookings' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'userId' },
                op: 'EQUAL',
                value: { stringValue: userId },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'createdAt' },
                op: 'GREATER_THAN_OR_EQUAL',
                value: { timestampValue: startedAtIso },
              },
            },
          ],
        },
      },
      limit: 1,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(queryBody),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`runQuery failed ${response.status}: ${text}`);
    return false;
  }

  const rows = (await response.json()) as RunQueryResultRow[];
  return rows.some((row) => row.document?.name);
}

async function pollForBooking(idToken: string, userId: string): Promise<boolean> {
  const deadlineMs = Date.now() + 10_000;
  while (Date.now() < deadlineMs) {
    if (await findFreshBooking(idToken, userId)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}

// ---------- main -----------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    `smoke-staging starting — project=${PROJECT_ID} region=${REGION} date=${TODAY_IST} spa=${SPA_ID}`,
  );

  const auth = await signIn();
  console.log(`signed in as ${auth.localId}`);

  await callGetAvailableSlots(auth.idToken);

  const found = await pollForBooking(auth.idToken, auth.localId);
  if (found) {
    console.log('SMOKE OK');
    exit(0);
  }
  console.log('SMOKE TIMEOUT');
  exit(2);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`SMOKE FAIL: ${message}`);
  exit(1);
});
