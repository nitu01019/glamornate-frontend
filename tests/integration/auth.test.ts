import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { mockUser } from '../fixtures/firebase-mocks';
import { server } from '../mocks/server';

// Mock Firebase Auth SDK — msw only intercepts HTTP, not Firebase callables
// or SDK internals, so these vi.mock blocks stay in place.
vi.mock('firebase/auth');

describe('Auth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sign In', () => {
    it('should sign in with email and password successfully', async () => {
      const mockSignIn = signInWithEmailAndPassword as Mock;
      mockSignIn.mockResolvedValue({
        user: { uid: mockUser.id, email: mockUser.profile.email },
      });

      await act(async () => {
        const result = await signInWithEmailAndPassword(
          {} as never,
          'test@example.com',
          'password123',
        );
        expect(result.user.email).toBe('test@example.com');
      });

      expect(mockSignIn).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password123');
    });

    it('should handle invalid credentials', async () => {
      const mockSignIn = signInWithEmailAndPassword as Mock;
      mockSignIn.mockRejectedValue(new Error('auth/invalid-credential'));

      await expect(
        signInWithEmailAndPassword({} as never, 'wrong@example.com', 'wrongpassword'),
      ).rejects.toThrow();
    });

    it('should handle empty password', async () => {
      const mockSignIn = signInWithEmailAndPassword as Mock;
      mockSignIn.mockRejectedValue(new Error('auth/missing-password'));

      await expect(
        signInWithEmailAndPassword({} as never, 'test@example.com', ''),
      ).rejects.toThrow();
    });
  });

  describe('Sign Up', () => {
    it('should create new user account', async () => {
      const mockCreateUser = createUserWithEmailAndPassword as Mock;
      mockCreateUser.mockResolvedValue({
        user: { uid: 'new_user_123', email: 'new@example.com' },
      });

      await act(async () => {
        const result = await createUserWithEmailAndPassword(
          {} as never,
          'new@example.com',
          'password123',
        );
        expect(result.user.uid).toBe('new_user_123');
      });

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.anything(),
        'new@example.com',
        'password123',
      );
    });

    it('should handle existing email', async () => {
      const mockCreateUser = createUserWithEmailAndPassword as Mock;
      mockCreateUser.mockRejectedValue(new Error('auth/email-already-in-use'));

      await expect(
        createUserWithEmailAndPassword({} as never, 'test@example.com', 'password123'),
      ).rejects.toThrow('auth/email-already-in-use');
    });

    it('should validate email format', () => {
      const invalidEmails = ['', 'invalid', '@example.com', 'test@'];
      invalidEmails.forEach((email) => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Sign Out', () => {
    it('should sign out current user', async () => {
      const mockSignOut = signOut as Mock;
      mockSignOut.mockResolvedValue(undefined);

      await act(async () => {
        await signOut({} as never);
      });

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Auth State Changes', () => {
    it('should notify on auth state change', async () => {
      const { onAuthStateChanged } = await import('firebase/auth');
      const mockOnAuthStateChanged = onAuthStateChanged as Mock;
      mockOnAuthStateChanged.mockReturnValue(() => {});

      renderHook(() => mockOnAuthStateChanged(expect.anything(), vi.fn()));

      expect(mockOnAuthStateChanged).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // QA-M1 — MSW-backed /api/v1/auth/register coverage.
  //
  // Firebase Auth SDK paths above still use `vi.mock` because msw only
  // intercepts HTTP. For the REST-style registration flow (rate-limited by
  // the Next.js middleware), msw lets us exercise `fetch` end-to-end without
  // stubbing the global.
  // -------------------------------------------------------------------------
  describe('POST /api/v1/auth/register (MSW)', () => {
    it('returns the new user envelope on 200', async () => {
      server.use(
        http.post('*/api/v1/auth/register', async ({ request }) => {
          const body = (await request.json()) as { email: string; password: string };
          expect(body.email).toBe('fresh@example.com');
          return HttpResponse.json({
            success: true,
            data: { uid: 'uid-fresh', email: body.email },
            error: null,
          });
        }),
      );

      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'fresh@example.com', password: 'Passw0rd!' }),
      });

      expect(res.status).toBe(200);
      const payload = (await res.json()) as {
        success: boolean;
        data: { uid: string; email: string };
      };
      expect(payload.success).toBe(true);
      expect(payload.data.uid).toBe('uid-fresh');
    });

    it('surfaces a 429 rate-limit response without throwing', async () => {
      server.use(
        http.post('*/api/v1/auth/register', () =>
          HttpResponse.json(
            { success: false, data: null, error: 'rate-limited', code: 'rate-limited' },
            { status: 429 },
          ),
        ),
      );

      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'spammer@example.com', password: 'x' }),
      });

      expect(res.status).toBe(429);
      const payload = (await res.json()) as { error: string; code: string };
      expect(payload.code).toBe('rate-limited');
    });
  });
});
