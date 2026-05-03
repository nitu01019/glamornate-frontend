/**
 * Unit tests for the FCM broadcast-topic helpers. Focuses on
 *   - `subscribeToBroadcastTopics`
 *   - `unsubscribeFromBroadcastTopics`
 * (see src/lib/messaging/fcm.ts). The setup/teardown helpers touch
 * Firestore and are covered indirectly by auth-provider tests; here we
 * exercise only the topic flow.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test, because
// `vi.mock` is hoisted but the module cache resolves eagerly on first import.
// ---------------------------------------------------------------------------

const subscribeToTopic = vi.fn();
const unsubscribeFromTopic = vi.fn();
const isNativePlatform = vi.fn(() => true);

vi.mock('@capacitor-firebase/messaging', () => ({
  FirebaseMessaging: {
    subscribeToTopic: (...args: unknown[]) => subscribeToTopic(...args),
    unsubscribeFromTopic: (...args: unknown[]) => unsubscribeFromTopic(...args),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

// Firestore is only touched by setup/teardown, not the topic helpers.
// We still stub it so the module import succeeds in a jsdom environment.
vi.mock('@/lib/firebase-client', () => ({
  getFirebaseFirestore: vi.fn(),
}));

// Silence the module-scoped logger.
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import {
  subscribeToBroadcastTopics,
  unsubscribeFromBroadcastTopics,
} from '@/lib/messaging/fcm';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('broadcast topic subscriptions', () => {
  beforeEach(() => {
    subscribeToTopic.mockReset();
    unsubscribeFromTopic.mockReset();
    subscribeToTopic.mockResolvedValue(undefined);
    unsubscribeFromTopic.mockResolvedValue(undefined);
    isNativePlatform.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subscribeToBroadcastTopics', () => {
    it('subscribes to both audience:all and audience:role_<role> on native', async () => {
      await subscribeToBroadcastTopics('customer');

      expect(subscribeToTopic).toHaveBeenCalledTimes(2);
      expect(subscribeToTopic).toHaveBeenCalledWith({ topic: 'audience:all' });
      expect(subscribeToTopic).toHaveBeenCalledWith({ topic: 'audience:role_customer' });
    });

    it('builds role-specific topic for each supported role', async () => {
      const roles = ['customer', 'spa_owner', 'spa_staff', 'admin'] as const;

      for (const role of roles) {
        subscribeToTopic.mockClear();
        await subscribeToBroadcastTopics(role);
        expect(subscribeToTopic).toHaveBeenCalledWith({ topic: 'audience:all' });
        expect(subscribeToTopic).toHaveBeenCalledWith({ topic: `audience:role_${role}` });
      }
    });

    it('is a no-op when FCM is unavailable (web platform)', async () => {
      isNativePlatform.mockReturnValue(false);

      await subscribeToBroadcastTopics('customer');

      expect(subscribeToTopic).not.toHaveBeenCalled();
    });

    it('swallows errors and resolves when subscribe throws', async () => {
      subscribeToTopic.mockRejectedValue(new Error('missing google-services.json'));

      // Should not throw to the caller — broadcast is best-effort.
      await expect(subscribeToBroadcastTopics('spa_owner')).resolves.toBeUndefined();
      // Both topics still attempted even though the first one failed.
      expect(subscribeToTopic).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribeFromBroadcastTopics', () => {
    it('unsubscribes from both audience:all and audience:role_<role> on native', async () => {
      await unsubscribeFromBroadcastTopics('customer');

      expect(unsubscribeFromTopic).toHaveBeenCalledTimes(2);
      expect(unsubscribeFromTopic).toHaveBeenCalledWith({ topic: 'audience:all' });
      expect(unsubscribeFromTopic).toHaveBeenCalledWith({ topic: 'audience:role_customer' });
    });

    it('is a no-op when FCM is unavailable (web platform)', async () => {
      isNativePlatform.mockReturnValue(false);

      await unsubscribeFromBroadcastTopics('customer');

      expect(unsubscribeFromTopic).not.toHaveBeenCalled();
    });

    it('swallows errors and resolves when unsubscribe throws', async () => {
      unsubscribeFromTopic.mockRejectedValue(new Error('network down'));

      await expect(unsubscribeFromBroadcastTopics('admin')).resolves.toBeUndefined();
      expect(unsubscribeFromTopic).toHaveBeenCalledTimes(2);
    });

    it('tolerates legacy / unknown role strings', async () => {
      // The unsubscribe API widens role to `string` so stale roles from an
      // older build still clean up correctly.
      await unsubscribeFromBroadcastTopics('legacy_unknown_role');

      expect(unsubscribeFromTopic).toHaveBeenCalledWith({
        topic: 'audience:role_legacy_unknown_role',
      });
    });
  });
});
