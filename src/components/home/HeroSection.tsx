'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { Search } from 'lucide-react';

export default function HeroSection() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  const displayName = user?.profile?.displayName?.split(' ')[0] || '';
  const greeting =
    hasMounted && isAuthenticated && displayName
      ? `Hi, ${displayName}!`
      : 'Welcome to Glamornate';

  return (
    <section className="bg-white px-4 pt-4 pb-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">{greeting}</h1>
      <button
        onClick={() => router.push('/spas')}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-100 rounded-2xl text-left transition-colors active:bg-gray-200"
      >
        <Search className="w-5 h-5 text-gray-400" />
        <span className="text-gray-500 text-[15px]">
          Search for spas, services...
        </span>
      </button>
    </section>
  );
}
