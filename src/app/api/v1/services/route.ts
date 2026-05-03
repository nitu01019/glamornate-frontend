import { NextRequest, NextResponse } from 'next/server'
import { catalogServices } from '@/data/glamornate-catalog'
import type { HomeService } from '@/lib/mock-data'

/**
 * GET /api/v1/services
 * List services with filtering, search, sorting, and pagination.
 *
 * Query params:
 *   ?category     — filter by categorySlug
 *   ?subcategory  — filter by subcategory field
 *   ?search       — case-insensitive match on name
 *   ?sort         — price_asc | price_desc | name_asc | rating_desc (default: ordering)
 *   ?limit        — page size (default 20, max 100)
 *   ?offset       — pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort')
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10), 1),
      100,
    )
    const offset = Math.max(
      parseInt(searchParams.get('offset') || '0', 10),
      0,
    )

    let filtered: HomeService[] = catalogServices.filter((s) => s.isActive)

    // Filter by category slug
    if (category) {
      filtered = filtered.filter((s) => s.categorySlug === category)
    }

    // Filter by subcategory
    if (subcategory) {
      filtered = filtered.filter(
        (s) =>
          s.subcategory !== undefined &&
          s.subcategory.toLowerCase() === subcategory.toLowerCase(),
      )
    }

    // Search: match against name (case-insensitive includes)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q))
    }

    // Sorting
    const sorted = [...filtered]
    switch (sort) {
      case 'price_asc':
        sorted.sort((a, b) => a.basePrice - b.basePrice)
        break
      case 'price_desc':
        sorted.sort((a, b) => b.basePrice - a.basePrice)
        break
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'rating_desc':
        sorted.sort((a, b) => b.rating - a.rating)
        break
      default:
        // Default: preserve original catalog ordering (by index)
        break
    }

    const total = sorted.length
    const paginated = sorted.slice(offset, offset + limit)

    return NextResponse.json(
      {
        success: true,
        data: paginated,
        meta: { total, limit, offset },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch services'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
