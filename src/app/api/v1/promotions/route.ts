import { NextResponse } from 'next/server'
import { promotions } from '@/lib/mock-data'

/**
 * GET /api/v1/promotions
 * Return active promotional banners, sorted by ordering.
 */
export async function GET() {
  try {
    const active = promotions
      .filter((p) => p.isActive)
      .sort((a, b) => a.ordering - b.ordering)

    return NextResponse.json(
      {
        success: true,
        data: active,
        error: null,
        meta: { total: active.length, page: 1, limit: active.length },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch promotions'
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    )
  }
}
