import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authenticateRequest, AuthError } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

const routeLogger = logger.child({ component: 'api/v1/spas' });

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

/**
 * GET /api/v1/spas
 * List spas with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FIREBASE_NOT_CONFIGURED',
            message: 'Database connection failed',
          },
        },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const after = searchParams.get('after');
    const city = searchParams.get('city');
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'active';
    const tier = searchParams.get('tier');
    const minRating = parseFloat(searchParams.get('minRating') || '0');
    const sortBy = searchParams.get('sortBy') || 'rating';

    let query = adminDb.collection('spas') as FirebaseFirestore.Query;

    // Apply filters
    query = query.where('isActive', '==', true);

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }
    if (tier) {
      query = query.where('tier', '==', tier);
    }
    if (category) {
      query = query.where('categories', 'array-contains', category);
    }
    if (minRating > 0) {
      query = query.where('rating.overall', '>=', minRating);
    }
    if (city) {
      const normalizedCity = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      query = query.where('location.city', '==', normalizedCity);
    }

    // Apply sorting
    if (sortBy === 'created') {
      query = query.orderBy('createdAt', 'desc');
    } else {
      query = query.orderBy('rating.overall', 'desc');
    }

    // Cursor-based pagination
    if (after) {
      const afterDoc = await adminDb.collection('spas').doc(after).get();
      if (afterDoc.exists) {
        query = query.startAfter(afterDoc);
      }
    }

    const snapshot = await query.limit(limit + 1).get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;
    const spas = docs.map((doc) => toPublicSpa(doc.id, doc.data() as Record<string, unknown>));
    const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

    return NextResponse.json(
      {
        success: true,
        data: {
          spas,
          pagination: {
            limit,
            hasMore,
            nextCursor: hasMore && lastDoc ? lastDoc.id : null,
          },
          filters: {
            city,
            category,
            status,
            tier,
            minRating,
            sortBy,
          },
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (error) {
    routeLogger.error('Failed to fetch spas', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch spas',
        },
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/spas
 * Create a new spa (for spa owners)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate once and capture the uid for use as ownerId
    const { uid: ownerId } = await authenticateRequest(request);

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FIREBASE_NOT_CONFIGURED',
            message: 'Database connection failed',
          },
        },
        { status: 500 },
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.location || !body.contact) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Missing required fields: name, location, contact',
          },
        },
        { status: 400 },
      );
    }

    // SECURITY: whitelist accepted client fields — never spread the full body.
    // This prevents field injection attacks where an attacker could set
    // isActive: true, status: 'active', ownerId: '<other_uid>', etc.
    const allowedSpaFields = [
      'name',
      'description',
      'location',
      'contact',
      'categories',
      'amenities',
      'operatingHours',
    ] as const;
    const spaInput: Record<string, unknown> = {};
    for (const field of allowedSpaFields) {
      if (field in body) {
        spaInput[field] = body[field];
      }
    }

    // Create spa document
    const spaRef = await adminDb.collection('spas').add({
      ...spaInput,
      ownerId, // always set server-side from authenticated token
      status: 'pending', // always start as pending — admin activates
      isActive: false, // not active until verified
      verification: {
        submittedAt: new Date().toISOString(),
        documents: [],
      },
      statistics: {
        totalBookings: 0,
        revenue: 0,
        averageRating: 0,
        activeStaff: 0,
      },
      rating: {
        overall: 0,
        count: 0,
        breakdown: {
          ambiance: 0,
          service: 0,
          therapist: 0,
          hygiene: 0,
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          spaId: spaRef.id,
          status: 'pending',
          message: 'Spa registration submitted. Your application is under review.',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(error.toResponse(), { status: error.status });
    }

    routeLogger.error('Failed to create spa', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CREATION_FAILED',
          message: 'Failed to create spa',
        },
      },
      { status: 500 },
    );
  }
}
