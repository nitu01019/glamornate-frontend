import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole, AuthError } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

// Force dynamic rendering — prevents Next.js from calling React.cache
// during static data collection (React 18 does not export React.cache).
export const dynamic = 'force-dynamic';

const routeLogger = logger.child({ component: 'api/v1/spas/[id]' });

const PUBLIC_SPA_FIELDS = [
  'name',
  'description',
  'location',
  'contact',
  'categories',
  'amenities',
  'operatingHours',
  'images',
  'rating',
  'slug',
  'isActive',
  'status',
  'featuredImage',
  'address',
  'city',
  'services',
  'reviewCount',
  'priceRange',
] as const;

function toPublicSpa(id: string, data: Record<string, unknown>) {
  const out: Record<string, unknown> = { id };
  for (const field of PUBLIC_SPA_FIELDS) {
    if (field in data) out[field] = data[field];
  }
  return out;
}

const ALLOWED_UPDATE_FIELDS = [
  'name',
  'description',
  'location',
  'contact',
  'categories',
  'amenities',
  'operatingHours',
  'images',
] as const;

function whitelistUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) {
      update[field] = body[field];
    }
  }
  return update;
}

/**
 * GET /api/v1/spas/[id]
 * Get spa details by ID or slug
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: spaId } = await params;
    const adminDb = getAdminDb();

    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Service unavailable' },
        },
        { status: 503 },
      );
    }

    let spaDoc = await adminDb.collection('spas').doc(spaId).get();

    if (!spaDoc.exists) {
      const slugQuery = await adminDb
        .collection('spas')
        .where('slug', '==', spaId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!slugQuery.empty) {
        spaDoc = slugQuery.docs[0];
      }
    }

    if (!spaDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Spa not found' },
        },
        { status: 404 },
      );
    }

    const spaData = spaDoc.data() as Record<string, unknown>;

    if (!spaData?.isActive) {
      return NextResponse.json({ success: false, error: 'Spa not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: toPublicSpa(spaDoc.id, spaData),
    });
  } catch (error: unknown) {
    routeLogger.error('Failed to fetch spa details', error);

    return NextResponse.json(
      {
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch spa details' },
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/spas/[id]
 * Update spa details (spa owners and admins only)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireRole(request, ['spa_owner', 'admin']);
    const { id: spaId } = await params;
    const body = await request.json();

    const adminDb = getAdminDb();

    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Service unavailable' },
        },
        { status: 503 },
      );
    }

    const spaDoc = await adminDb.collection('spas').doc(spaId).get();
    if (!spaDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Spa not found' },
        },
        { status: 404 },
      );
    }

    const spaData = spaDoc.data();
    if (spaData?.ownerId !== uid) {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userRole = userDoc.exists ? userDoc.data()?.role : null;
      if (userRole !== 'admin') {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'You do not own this spa' },
          },
          { status: 403 },
        );
      }
    }

    const updateData = whitelistUpdate(body);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No valid fields to update',
          },
        },
        { status: 400 },
      );
    }

    await adminDb
      .collection('spas')
      .doc(spaId)
      .update({
        ...updateData,
        updatedAt: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      data: {
        id: spaId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(error.toResponse(), { status: error.status });
    }

    routeLogger.error('Failed to update spa', error);

    return NextResponse.json(
      {
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update spa' },
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/spas/[id]
 * Soft-delete a spa (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(request, ['admin']);
    const { id: spaId } = await params;

    const adminDb = getAdminDb();

    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Service unavailable' },
        },
        { status: 503 },
      );
    }

    const spaDoc = await adminDb.collection('spas').doc(spaId).get();
    if (!spaDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Spa not found' },
        },
        { status: 404 },
      );
    }

    await adminDb.collection('spas').doc(spaId).update({
      isActive: false,
      status: 'deleted',
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: spaId,
        message: 'Spa deleted successfully',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(error.toResponse(), { status: error.status });
    }

    routeLogger.error('Failed to delete spa', error);

    return NextResponse.json(
      {
        success: false,
        error: { code: 'DELETE_FAILED', message: 'Failed to delete spa' },
      },
      { status: 500 },
    );
  }
}
