import { Card, CardContent } from '@/components/ui/card';

export interface StaffStatsData {
  total: number;
  online: number;
  onLeave: number;
  totalBookings: number;
}

export function StaffStats({ stats, isLoading }: { stats: StaffStatsData; isLoading: boolean }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {isLoading ? (
        <>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-24 bg-gray-100 rounded-xl animate-pulse shrink-0" />
          ))}
        </>
      ) : (
        <>
          <Card className="border-0 shadow-sm rounded-xl shrink-0">
            <CardContent className="p-3">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-xl shrink-0">
            <CardContent className="p-3">
              <div className="text-xs text-gray-500">Online</div>
              <div className="text-xl font-bold text-emerald-600">{stats.online}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-xl shrink-0">
            <CardContent className="p-3">
              <div className="text-xs text-gray-500">On Leave</div>
              <div className="text-xl font-bold text-amber-600">{stats.onLeave}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-xl shrink-0">
            <CardContent className="p-3">
              <div className="text-xs text-gray-500">Bookings</div>
              <div className="text-xl font-bold text-gray-900">{stats.totalBookings}</div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
