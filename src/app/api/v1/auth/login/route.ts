import { NextResponse } from 'next/server';

/**
 * POST /api/v1/auth/login
 * This endpoint has been deprecated. Use client-side Firebase Authentication instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'This endpoint has been deprecated. Use client-side Firebase Authentication (signInWithEmailAndPassword) instead.',
      code: 'ENDPOINT_DEPRECATED',
    },
    { status: 410 },
  );
}
