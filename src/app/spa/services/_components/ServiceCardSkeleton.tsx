'use client';

/**
 * Loading skeleton for a single service card. Extracted from
 * `spa/services/page.tsx` during Phase 2 Agent-07 (F5 carve).
 */

import { Card, CardContent } from '@/components/ui/card';

export function ServiceCardSkeleton() {
  return (
    <Card className="border-slate-100">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse" />
          <div className="w-8 h-8 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-6 bg-slate-200 rounded w-3/4 mb-2 animate-pulse" />
        <div className="h-4 bg-slate-200 rounded w-full mb-4 animate-pulse" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4">
            <div className="h-4 bg-slate-200 rounded w-16 animate-pulse" />
            <div className="h-4 bg-slate-200 rounded w-12 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
            <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
