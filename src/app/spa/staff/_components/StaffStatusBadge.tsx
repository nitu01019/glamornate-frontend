import { CheckCircle } from 'lucide-react';

export function StaffStatusIndicator({ status, onLeave }: { status: string; onLeave: boolean }) {
  if (onLeave) {
    return <div className="w-3 h-3 bg-amber-500 rounded-full" />;
  }
  switch (status) {
    case 'online':
      return <div className="w-3 h-3 bg-emerald-500 rounded-full" />;
    case 'offline':
    default:
      return <div className="w-3 h-3 bg-slate-400 rounded-full" />;
  }
}

export function StaffStatusBadge({ status, onLeave }: { status: string; onLeave: boolean }) {
  if (onLeave) {
    return (
      <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
        On Leave
      </span>
    );
  }
  switch (status) {
    case 'online':
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">
          <CheckCircle className="w-3 h-3" /> Online
        </span>
      );
    case 'offline':
    default:
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
          Offline
        </span>
      );
  }
}
