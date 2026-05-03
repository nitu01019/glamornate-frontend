import { NextResponse } from 'next/server'
import { catalogCategories, catalogData } from '@/data/glamornate-catalog'

/**
 * GET /api/v1/services/categories
 * Return all service categories with computed serviceCount and priceRange.
 */
export async function GET() {
  try {
    const categories = catalogData
      .map((cat) => {
        const allPrices: number[] = []
        let serviceCount = 0

        for (const subcategory of cat.subcategories) {
          serviceCount += subcategory.items.length
          for (const catalogItem of subcategory.items) {
            allPrices.push(catalogItem.price)
          }
        }

        const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0
        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0

        // Find the matching catalogCategory entry for image and other fields
        const catEntry = catalogCategories.find((c) => c.id === cat.id)

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          image: catEntry?.image ?? `/images/categories/${cat.slug}.webp`,
          serviceCount,
          priceRange: { min: minPrice, max: maxPrice },
          ordering: cat.ordering,
        }
      })
      .sort((a, b) => a.ordering - b.ordering)

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch categories'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
