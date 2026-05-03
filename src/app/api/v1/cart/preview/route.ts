import { NextRequest, NextResponse } from 'next/server';
import { services } from '@/lib/mock-data';

/**
 * POST /api/v1/cart/preview
 *
 * Round 5 C-6 — renamed from `/api/v1/cart/validate`. This is the canonical
 * "price + availability preview" endpoint: it does NOT persist anything; it
 * simply echoes the user's cart back with current prices, durations, and
 * availability flags so the UI can render the summary confidently.
 *
 * Response envelope matches the app-wide `ApiResponse<T>` shape so
 * `apiClient.post` can unwrap it uniformly.
 *
 * Historical note: the legacy `/api/v1/cart/validate` path is preserved as a
 * thin server-side proxy that forwards to this route. The 308-redirect option
 * was rejected because POST bodies drop on some Capacitor WebView + CDN edge
 * combinations (see F2 Eng in `docs/plans/2026-04-20-round5-plan.md`).
 */

interface CartItem {
  serviceId: string;
  quantity: number;
}

interface ValidatedCartItem {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number | null;
  discountPercent: number | null;
  duration: string;
  durationMinutes: number;
  lineTotal: number;
  available: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    // Validate request body shape
    if (
      !body ||
      typeof body !== 'object' ||
      !('items' in body) ||
      !Array.isArray((body as { items: unknown }).items)
    ) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: 'Request body must contain an "items" array',
        },
        { status: 400 },
      );
    }

    const items = (body as { items: CartItem[] }).items;

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: 'Cart is empty' },
        { status: 400 },
      );
    }

    if (items.length > 50) {
      return NextResponse.json(
        { success: false, data: null, error: 'Cart cannot exceed 50 items' },
        { status: 400 },
      );
    }

    const validated: ValidatedCartItem[] = [];
    const warnings: string[] = [];

    for (const item of items) {
      if (!item.serviceId || typeof item.serviceId !== 'string') {
        warnings.push(`Invalid serviceId in cart item`);
        continue;
      }

      const quantity = Math.max(1, Math.min(item.quantity || 1, 10));
      const service = services.find((s) => s.id === item.serviceId);

      if (!service) {
        warnings.push(`Service not found: ${item.serviceId}`);
        validated.push({
          serviceId: item.serviceId,
          name: 'Unknown Service',
          quantity,
          unitPrice: 0,
          originalPrice: null,
          discountPercent: null,
          duration: '0min',
          durationMinutes: 0,
          lineTotal: 0,
          available: false,
        });
        continue;
      }

      if (!service.isActive) {
        warnings.push(`Service unavailable: ${service.name}`);
      }

      validated.push({
        serviceId: service.id,
        name: service.name,
        quantity,
        unitPrice: service.basePrice,
        originalPrice: service.originalPrice ?? null,
        discountPercent: service.discountPercent ?? null,
        duration: service.duration,
        durationMinutes: service.durationMinutes,
        lineTotal: service.basePrice * quantity,
        available: service.isActive,
      });
    }

    const subtotal = validated.reduce((sum, v) => sum + v.lineTotal, 0);
    const totalDuration = validated.reduce((sum, v) => sum + v.durationMinutes * v.quantity, 0);
    const totalSavings = validated.reduce((sum, v) => {
      if (v.originalPrice && v.available) {
        return sum + (v.originalPrice - v.unitPrice) * v.quantity;
      }
      return sum;
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        items: validated,
        summary: {
          itemCount: validated.filter((v) => v.available).length,
          subtotal,
          totalSavings,
          totalDurationMinutes: totalDuration,
          currency: 'INR',
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      error: null,
    });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, data: null, error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to validate cart';
    return NextResponse.json({ success: false, data: null, error: message }, { status: 500 });
  }
}
