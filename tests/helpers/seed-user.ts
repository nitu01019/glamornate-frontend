/**
 * seed-user.ts — idempotent test-user provisioning against the Firebase
 * Auth Emulator.
 *
 * Consumed by every Round 6 Phase 3 spec that needs an authenticated
 * session. The helper talks to the Auth emulator's REST API directly so
 * we avoid pulling in the firebase-admin SDK from Playwright workers
 * (admin has a giant dependency tree and requires credentials even in
 * emulator mode).
 *
 * Idempotency contract:
 *   - Calling `seedTestUser({ email, password })` twice in a row must
 *     succeed without throwing. When the user already exists with the
 *     same credentials, the helper returns the existing `localId` (uid).
 *     When the user exists with a different password, we reset the
 *     password via the admin REST endpoint.
 *   - Calling `deleteTestUser({ uid })` against a non-existent user is a
 *     no-op.
 *
 * Environment:
 *   - `FIREBASE_AUTH_EMULATOR_HOST` — default `127.0.0.1:9099`. The same
 *     env var the Firebase Auth SDK reads, so a spec that sets it once
 *     for the whole emulator run picks it up from here automatically.
 *   - `GCLOUD_PROJECT` / `FIREBASE_PROJECT_ID` — default
 *     `glamornate-758c6` (mirrors the real project id so the emulator
 *     REST endpoints line up). Override per-run if needed.
 *
 * This helper NEVER touches production — it asserts the emulator env
 * var is present and refuses to run against a non-localhost host.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeedUserInput {
  /** Email the user will sign in with. */
  readonly email: string;
  /** Plain password. The Auth emulator hashes internally. */
  readonly password: string;
  /** Optional display name — defaults to the local-part of email. */
  readonly displayName?: string;
  /** If true, mark the email as verified (matches production expectation
   *  — 3A's callable refuses unverified emails). Defaults to `true`. */
  readonly emailVerified?: boolean;
  /** Optional fixed uid. When omitted the emulator assigns one. */
  readonly localId?: string;
}

export interface SeedUserResult {
  readonly uid: string;
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly emailVerified: boolean;
}

export interface DeleteTestUserInput {
  readonly uid: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_EMULATOR_HOST = '127.0.0.1:9099';
const DEFAULT_PROJECT_ID = 'glamornate-758c6';
const EMULATOR_BEARER_TOKEN = 'owner'; // The Auth emulator accepts `Bearer owner`.

// ---------------------------------------------------------------------------
// Env resolution
// ---------------------------------------------------------------------------

function resolveEmulatorHost(): string {
  const raw = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? DEFAULT_EMULATOR_HOST;
  if (!raw.includes('127.0.0.1') && !raw.includes('localhost')) {
    throw new Error(
      `Refusing to run seed-user against non-localhost host: ${raw}. ` +
        'This helper is test-only.',
    );
  }
  return raw;
}

function resolveProjectId(): string {
  return (
    process.env.GCLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID ??
    DEFAULT_PROJECT_ID
  );
}

function emulatorBaseUrl(host: string, projectId: string): string {
  return `http://${host}/identitytoolkit.googleapis.com/v1/projects/${projectId}`;
}

function adminBaseUrl(host: string, projectId: string): string {
  return `http://${host}/emulator/v1/projects/${projectId}`;
}

// ---------------------------------------------------------------------------
// Low-level REST helpers
// ---------------------------------------------------------------------------

interface EmulatorUserRecord {
  readonly localId: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly emailVerified?: boolean;
}

interface LookupResponse {
  readonly users?: readonly EmulatorUserRecord[];
}

async function lookupByEmail(
  email: string,
  baseUrl: string,
): Promise<EmulatorUserRecord | null> {
  const res = await fetch(`${baseUrl}/accounts:lookup?key=fake-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EMULATOR_BEARER_TOKEN}`,
    },
    body: JSON.stringify({ email: [email] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth emulator lookup failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as LookupResponse;
  return body.users && body.users.length > 0 ? body.users[0] : null;
}

async function signUp(
  input: SeedUserInput,
  baseUrl: string,
): Promise<EmulatorUserRecord> {
  const res = await fetch(`${baseUrl}/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EMULATOR_BEARER_TOKEN}`,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      displayName: input.displayName ?? input.email.split('@')[0],
      returnSecureToken: false,
      ...(input.localId ? { localId: input.localId } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth emulator signUp failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as EmulatorUserRecord & {
    readonly localId: string;
  };
  return body;
}

async function updateUser(
  uid: string,
  body: Record<string, unknown>,
  baseUrl: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/accounts:update?key=fake-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EMULATOR_BEARER_TOKEN}`,
    },
    body: JSON.stringify({ localId: uid, ...body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth emulator update failed (${res.status}): ${text}`);
  }
}

async function deleteAccountsByUid(
  uids: readonly string[],
  adminUrl: string,
): Promise<void> {
  if (uids.length === 0) return;
  const res = await fetch(`${adminUrl}/accounts:batchDelete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EMULATOR_BEARER_TOKEN}`,
    },
    body: JSON.stringify({
      localIds: [...uids],
      force: true,
    }),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Auth emulator delete failed (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seed (or re-seed) a test user in the Auth emulator.
 *
 * Idempotent: safe to call from `beforeEach`, from inside a single spec,
 * or concurrently across parallel workers using different emails.
 */
export async function seedTestUser(input: SeedUserInput): Promise<SeedUserResult> {
  const host = resolveEmulatorHost();
  const projectId = resolveProjectId();
  const baseUrl = emulatorBaseUrl(host, projectId);

  const displayName = input.displayName ?? input.email.split('@')[0];
  const emailVerified = input.emailVerified ?? true;

  const existing = await lookupByEmail(input.email, baseUrl);
  let record: EmulatorUserRecord;

  if (existing) {
    // Reset password + verified state to the caller's requested values
    // so successive spec runs always start from a known state.
    await updateUser(
      existing.localId,
      {
        password: input.password,
        emailVerified,
        displayName,
      },
      baseUrl,
    );
    record = {
      ...existing,
      displayName,
      emailVerified,
    };
  } else {
    record = await signUp(input, baseUrl);
    if (emailVerified) {
      await updateUser(record.localId, { emailVerified: true }, baseUrl);
    }
  }

  return {
    uid: record.localId,
    email: input.email,
    password: input.password,
    displayName,
    emailVerified,
  };
}

/**
 * Delete a seeded test user. Idempotent — returns silently when the
 * user does not exist.
 */
export async function deleteTestUser(input: DeleteTestUserInput): Promise<void> {
  const host = resolveEmulatorHost();
  const projectId = resolveProjectId();
  const adminUrl = adminBaseUrl(host, projectId);
  await deleteAccountsByUid([input.uid], adminUrl);
}

/**
 * Convenience: delete every user the emulator currently knows about.
 * Useful as a `globalSetup` hook or when a suite needs a pristine slate.
 */
export async function clearAllEmulatorUsers(): Promise<void> {
  const host = resolveEmulatorHost();
  const projectId = resolveProjectId();
  const adminUrl = adminBaseUrl(host, projectId);
  const res = await fetch(`${adminUrl}/accounts`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${EMULATOR_BEARER_TOKEN}`,
    },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(
      `Auth emulator clearAllEmulatorUsers failed (${res.status}): ${text}`,
    );
  }
}

/**
 * A canonical fixture — most specs just need a signed-in customer with a
 * strong password. Caller provides an email suffix so parallel workers
 * never collide.
 *
 * @param tag Arbitrary string appended to the email local-part so each
 *   spec can scope its own user (`'change-password'`, `'delete-account'`).
 */
export async function seedDefaultCustomer(tag: string): Promise<SeedUserResult> {
  const safeTag = tag.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return seedTestUser({
    email: `qa-${safeTag}@glamornate.test`,
    password: 'CorrectHorse42!',
    displayName: `QA ${safeTag}`,
    emailVerified: true,
  });
}
