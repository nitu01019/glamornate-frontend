import { NextRequest, NextResponse } from 'next/server'
import { catalogServices } from '@/data/glamornate-catalog'
import type { HomeService } from '@/lib/mock-data'

export type FallbackLevel = 'city' | 'backfill' | 'platform'

/**
 * GET /api/v1/services/most-booked
 * Return most booked services, sorted by bookingCount descending.
 *
 * Query params:
 *   ?category — filter by categorySlug
 *   ?limit   — max results (default 10, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '10', 10), 1),
      50,
    )

    let active: HomeService[] = catalogServices.filter((s) => s.isActive)

    // Filter by category slug
    if (category) {
      active = active.filter((s) => s.categorySlug === category)
    }

    // Sort by bookingCount descending
    const sorted = [...active].sort(
      (a, b) => b.bookingCount - a.bookingCount,
    )

    const results = sorted.slice(0, limit)

    return NextResponse.json(
      {
        success: true,
        data: results,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch most booked services'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
