'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase-config';

export function DemoModeBanner() {
  const [isDismissed, setIsDismissed] = useState(false);
  const isDemoMode = !isFirebaseConfigured();

  if (!isDemoMode || isDismissed) return null;

  return (
    <div className="bg-brand-gold-500 text-white px-4 py-2 text-sm flex items-center justify-center gap-2 sticky top-0 z-[100]">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        <strong>Running in demo mode</strong> - Data is simulated. Configure Firebase to see live data.
      </span>
      <button
        onClick={() => setIsDismissed(true)}
        className="ml-4 p-1 hover:bg-brand-gold-600 rounded transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
