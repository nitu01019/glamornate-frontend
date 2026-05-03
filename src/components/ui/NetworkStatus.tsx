'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Check initial state
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gray-900 text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium animate-fade-in">
      <WifiOff className="w-4 h-4" />
      <span>You&apos;re offline. Some features may not work.</span>
    </div>
  );
}
