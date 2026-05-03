import { NextRequest, NextResponse } from 'next/server';
import { createBooking, getUserBookings } from '@/lib/firebase-client/bookings';
import { authenticateRequest, AuthError } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import type { BookingRequest, CartItem } from '@/types';

/**
 * Calculate total price server-side by looking up service prices from Firestore.
 * Falls back to summing cart item prices if Firestore is unavailable.
 */
async function calculateTotalAmount(services: CartItem[]): Promise<number> {
  const adminDb = getAdminDb();

  if (!adminDb) {
    throw new Error('Service unavailable');
  }

  let total = 0;

  for (const item of services) {
    const serviceDoc = await adminDb.collection('services').doc(item.serviceId).get();

    if (serviceDoc.exists) {
      const serviceData = serviceDoc.data()!;
      const price = serviceData.basePrice ?? 0;
      total += price * item.quantity;
    } else {
      // Service not found — reject the booking
      throw new Error(`Service not found: ${item.serviceId}`);
    }
  }

  return total;
}

/**
 * Calculate total duration server-side by looking up service durations from Firestore.
 * Falls back to summing cart item durations if Firestore is unavailable.
 */
async function calculateTotalDuration(services: CartItem[]): Promise<number> {
  const adminDb = getAdminDb();

  if (!adminDb) {
    throw new Error('Service unavailable');
  }

  let total = 0;

  for (const item of services) {
    const serviceDoc = await adminDb.collection('services').doc(item.serviceId).get();

    if (serviceDoc.exists) {
      const serviceData = serviceDoc.data()!;
      const duration = serviceData.baseDuration ?? 0;
      total += duration * item.quantity;
    }
  }

  return total;
}

/**
 * POST /api/v1/bookings
 * Create a new booking from a BookingRequest payload.
 * Requires authentication. userId is derived from the token; totalAmount is calculated server-side.
 */
export async function POST(request: NextRequest) {
  try {
    // ---- Authenticate ----
    const { uid } = await authenticateRequest(request);

    const body = (await request.json()) as Partial<BookingRequest>;

    // ---- Validate required fields (userId and totalAmount are NOT accepted from the client) ----
    const missing: string[] = [];
    if (!body.services || body.services.length === 0) missing.push('services');
    if (!body.date) missing.push('date');
    if (!body.timeSlot) missing.push('timeSlot');
    if (!body.location) missing.push('location');

    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // ---- If home booking, validate address fields ----
    if (body.location === 'home') {
      const addr = body.address;
      if (!addr) {
        return NextResponse.json(
          {
            success: false,
            error: 'Address is required for home bookings (fullAddress, city, pincode, phone)',
          },
          { status: 400 },
        );
      }

      const addrMissing: string[] = [];
      if (!addr.fullAddress) addrMissing.push('fullAddress');
      if (!addr.city) addrMissing.push('city');
      if (!addr.pincode) addrMissing.push('pincode');
      if (!addr.phone) addrMissing.push('phone');

      if (addrMissing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing address fields for home booking: ${addrMissing.join(', ')}`,
          },
          { status: 400 },
        );
      }
    }

    // ---- Require adminDb before calculating price/duration server-side ----
    if (!getAdminDb()) {
      return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
    }

    // ---- Calculate price and duration server-side ----
    const totalAmount = await calculateTotalAmount(body.services!);
    const totalDuration = await calculateTotalDuration(body.services!);

    // ---- Create the booking (use authenticated uid, not client-supplied userId) ----
    const bookingRequest: BookingRequest = {
      userId: uid,
      services: body.services!,
      date: body.date!,
      timeSlot: body.timeSlot!,
      location: body.location!,
      address: body.address,
      totalAmount,
      totalDuration,
      notes: body.notes,
    };

    const bookingRecord = await createBooking(bookingRequest);

    return NextResponse.json({ success: true, data: bookingRecord }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(error.toResponse(), { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Failed to create booking';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/v1/bookings
 * Fetch bookings for the authenticated user.
 * Admin users may pass ?userId to fetch another user's bookings.
 */
export async function GET(request: NextRequest) {
  try {
    // ---- Authenticate ----
    const { uid } = await authenticateRequest(request);

    // Default to the authenticated user's bookings
    let targetUserId = uid;

    // Allow admin to fetch bookings for another user
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');

    if (requestedUserId && requestedUserId !== uid) {
      const adminDb = getAdminDb();
      if (!adminDb) {
        return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
      }
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userRole = userDoc.data()?.role;
      if (userRole !== 'admin') {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
      targetUserId = requestedUserId;
    }

    const bookings = await getUserBookings(targetUserId);

    return NextResponse.json({
      success: true,
      data: bookings,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(error.toResponse(), { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch bookings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
