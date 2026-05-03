import { NextRequest, NextResponse } from 'next/server'
import { catalogServices, getServiceById } from '@/data/glamornate-catalog'

// Force dynamic rendering — prevents Next.js from calling React.cache
// during static data collection (React 18 does not export React.cache).
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/services/[id]
 * Return a single service by ID or slug.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Service ID is required' },
        { status: 400 },
      )
    }

    // Try by ID first, then fall back to slug lookup
    const service =
      getServiceById(id) ??
      catalogServices.find((s) => s.slug === id)

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: service,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch service'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
