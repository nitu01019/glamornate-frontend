'use client';

import { Card, CardContent } from '@/components/ui/card';
import { StickyNote } from 'lucide-react';

export interface SpaBookingNotesCardProps {
  notes?: string;
  specialRequests?: string;
}

export function SpaBookingNotesCard({ notes, specialRequests }: SpaBookingNotesCardProps) {
  const trimmedNotes = notes?.trim();
  const trimmedRequests = specialRequests?.trim();
  if (!trimmedNotes && !trimmedRequests) return null;

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-maroon-100 rounded-xl flex items-center justify-center shrink-0">
            <StickyNote className="w-5 h-5 text-brand-maroon-600" />
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Notes</p>
        </div>
        {trimmedNotes && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Customer Notes
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{trimmedNotes}</p>
          </div>
        )}
        {trimmedRequests && (
          <div className={trimmedNotes ? 'border-t border-gray-100 pt-3' : ''}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Special Requests
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {trimmedRequests}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
