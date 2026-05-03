import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

// Force dynamic rendering — prevents Next.js from calling React.cache
// during static data collection (React 18 does not export React.cache).
export const dynamic = 'force-dynamic';

const routeLogger = logger.child({ component: 'api/v1/bookings/[id]' });

type BookingAuthz =
  | { ok: true; isOwner: boolean; isAdmin: boolean; isSpaOwner: boolean }
  | { ok: false };

/**
 * Shared authorization check for booking access.
 *
 * A principal may access a booking when ANY of the following are true:
 *   - they are the booking's owner (customer who created it), OR
 *   - they hold the `admin` platform role, OR
 *   - they hold the `spa_owner` role AND their spa matches `booking.spaId`.
 *
 * A bare `spa_owner` role is NEVER sufficient — spa scope must match. This
 * prevents an IDOR where a spa_owner at spa B could touch bookings at spa A.
 */
function authorizeBookingAccess(params: {
  uid: string;
  userRole: string | null | undefined;
  userSpaId: string | null | undefined;
  booking: { userId?: string; spaId?: string };
}): BookingAuthz {
  const { uid, userRole, userSpaId, booking } = params;
  const isOwner = booking.userId === uid;
  const isAdmin = userRole === 'admin';
  const isSpaOwner =
    userRole === 'spa_owner' &&
    typeof userSpaId === 'string' &&
    userSpaId.length > 0 &&
    booking.spaId === userSpaId;
  if (!isOwner && !isAdmin && !isSpaOwner) return { ok: false };
  return { ok: true, isOwner, isAdmin, isSpaOwner };
}

/**
 * GET /api/v1/bookings/[id]
 * Get a booking by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await authenticateRequest(request);
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database connection failed',
          },
        },
        { status: 500 },
      );
    }

    const { id: bookingId } = await params;

    const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get();

    if (!bookingDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' },
        },
        { status: 404 },
      );
    }

    const booking = bookingDoc.data()!;

    // Verify ownership, admin, or spa_owner (scoped to their spa) access
    if (booking.userId !== uid) {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const authz = authorizeBookingAccess({
        uid,
        userRole: userData?.role,
        userSpaId: userData?.spaData?.spaId ?? null,
        booking: { userId: booking.userId, spaId: booking.spaId },
      });

      if (!authz.ok) {
        const isMisscopedSpaOwner =
          userData?.role === 'spa_owner' &&
          typeof userData?.spaData?.spaId === 'string' &&
          booking.spaId !== userData.spaData.spaId;
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: isMisscopedSpaOwner
                ? 'Access denied. This booking does not belong to your spa.'
                : 'Access denied',
            },
          },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: bookingDoc.id,
        ...booking,
      },
    });
  } catch (error) {
    routeLogger.error('Failed to fetch booking', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch booking' },
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/bookings/[id]
 * Update a booking
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await authenticateRequest(request);
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database connection failed',
          },
        },
        { status: 500 },
      );
    }

    const { id: bookingId } = await params;
    const body = await request.json();

    const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' },
        },
        { status: 404 },
      );
    }

    const booking = bookingDoc.data()!;

    // Determine user role & spa scope, then authorize via shared helper.
    // This closes an IDOR where ANY spa_owner could PATCH ANY spa's bookings —
    // spa_owner access now requires booking.spaId === userData.spaData.spaId.
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const userRole = userData?.role ?? null;
    const authz = authorizeBookingAccess({
      uid,
      userRole,
      userSpaId: userData?.spaData?.spaId ?? null,
      booking: { userId: booking.userId, spaId: booking.spaId },
    });

    if (!authz.ok) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        },
        { status: 403 },
      );
    }

    const { isOwner, isAdmin, isSpaOwner } = authz;
    const isSpaOwnerOrAdmin = isSpaOwner || isAdmin;

    const updates: Record<string, unknown> = {};

    if (isOwner && !isSpaOwnerOrAdmin) {
      // Customers can only update limited fields.
      // voucherCode is read-only on customer surface; voucher application uses the redeemVoucher callable.
      const allowedFields = ['notes', 'specialRequests'];
      for (const key of allowedFields) {
        if (key in body) {
          updates[key] = body[key];
        }
      }
    }

    // Allow status updates for spa owners/admins.
    // Post-Stripe state machine: pay-at-spa only. Allowed statuses are
    // 'confirmed' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'.
    if (body.bookingStatus && isSpaOwnerOrAdmin) {
      // Operational statuses that spa owners can set
      const spaOwnerStatuses = [
        'en_route',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
      ];

      if (!isAdmin && !spaOwnerStatuses.includes(body.bookingStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `Spa owners can only set statuses: ${spaOwnerStatuses.join(', ')}`,
            },
          },
          { status: 403 },
        );
      }

      const validTransitions: Record<string, string[]> = {
        confirmed: ['en_route', 'in_progress', 'cancelled', 'no_show'],
        en_route: ['in_progress', 'cancelled', 'no_show'],
        in_progress: ['completed', 'cancelled'],
      };

      const currentStatus = booking.bookingStatus;
      const allowedStatuses = validTransitions[currentStatus] || [];

      if (!allowedStatuses.includes(body.bookingStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: `Cannot transition from ${currentStatus} to ${body.bookingStatus}`,
            },
          },
          { status: 400 },
        );
      }

      updates.bookingStatus = body.bookingStatus;

      const statusHistoryEntry = {
        status: body.bookingStatus,
        from: currentStatus,
        to: body.bookingStatus,
        actor: uid,
        actorId: uid,
        timestamp: new Date().toISOString(),
        reason: body.reason,
      };

      updates.statusHistory = [...(booking.statusHistory || []), statusHistoryEntry];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NO_UPDATES', message: 'No valid fields to update' },
        },
        { status: 400 },
      );
    }

    updates.updatedAt = new Date().toISOString();

    await adminDb.collection('bookings').doc(bookingId).update(updates);

    return NextResponse.json({
      success: true,
      data: {
        id: bookingId,
        ...updates,
      },
    });
  } catch (error) {
    routeLogger.error('Failed to update booking', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update booking' },
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/bookings/[id]
 * Cancel/delete a booking
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { uid } = await authenticateRequest(request);
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database connection failed',
          },
        },
        { status: 500 },
      );
    }

    const { id: bookingId } = await params;

    const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' },
        },
        { status: 404 },
      );
    }

    const booking = bookingDoc.data()!;

    // Verify ownership, admin, or spa_owner (scoped to their spa) access.
    // Previously this gated only on admin; spa_owners at the same spa should
    // also be permitted to cancel — and crucially, spa_owners at OTHER spas
    // must NOT be able to cancel (IDOR guard).
    if (booking.userId !== uid) {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const authz = authorizeBookingAccess({
        uid,
        userRole: userData?.role,
        userSpaId: userData?.spaData?.spaId ?? null,
        booking: { userId: booking.userId, spaId: booking.spaId },
      });
      if (!authz.ok) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access denied' },
          },
          { status: 403 },
        );
      }
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) || {};
    } catch {
      // No body provided — use defaults
    }
    const rawReason = typeof body.reason === 'string' ? body.reason : '';
    // Sanitize: trim, enforce max length (500 chars), strip HTML tags
    const reason = rawReason
      .trim()
      .slice(0, 500)
      .replace(/<[^>]*>/g, '');
    const pricing = booking.pricing || {};

    await adminDb
      .collection('bookings')
      .doc(bookingId)
      .update({
        bookingStatus: 'cancelled',
        cancellation: {
          reason: reason || 'Cancelled by user',
          cancelledBy: booking.userId === uid ? 'customer' : 'admin',
          cancelledAt: new Date().toISOString(),
          refundedAmount: pricing.total || 0,
        },
        updatedAt: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      data: {
        bookingId,
        bookingStatus: 'cancelled',
        cancellation: {
          reason: reason || 'Cancelled by user',
          cancelledBy: booking.userId === uid ? 'customer' : 'admin',
          cancelledAt: new Date().toISOString(),
          refundedAmount: pricing.total || 0,
        },
      },
    });
  } catch (error) {
    routeLogger.error('Failed to cancel booking', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CANCEL_FAILED', message: 'Failed to cancel booking' },
      },
      { status: 500 },
    );
  }
}
