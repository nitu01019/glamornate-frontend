'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import { ChevronLeft, MapPin, Star, Heart, Loader2, Calendar } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-provider';
import { useSpa } from '@/hooks/useSpas';
import { NoFavorites } from '@/components/ui/EmptyState';

function FavoriteSpaCard({ spaId, onRemove, isRemoving }: { spaId: string; onRemove: (spaId: string) => void; isRemoving: boolean }) {
  const { data: spa, isLoading, error } = useSpa(spaId);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="aspect-[3/2] bg-gray-100 animate-pulse" />
        <div className="p-4 space-y-2">
          <div className="h-5 bg-gray-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !spa) {
    return (
      <div className="bg-white rounded-2xl p-4 text-center">
        <p className="text-gray-500 text-sm mb-2">Failed to load spa</p>
        <button onClick={() => onRemove(spaId)} className="text-brand-maroon-500 text-sm font-medium">
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="relative aspect-[3/2]">
        <Link href={`/spas/${spaId}`}>
          <Image
            src={spa.featuredImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(spa.name)}&background=f43f5e&color=fff&size=400`}
            alt={spa.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </Link>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        
        {/* Favorite Button */}
        <button
          onClick={() => onRemove(spaId)}
          disabled={isRemoving}
          className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
        >
          {isRemoving ? (
            <Loader2 className="w-5 h-5 text-brand-maroon-500 animate-spin" />
          ) : (
            <Heart className="w-5 h-5 text-brand-maroon-500 fill-brand-maroon-500" />
          )}
        </button>

        {/* Premium Badge */}
        {spa.tier === 'premium' && (
          <span className="absolute top-3 left-3 px-2 py-1 bg-gradient-to-r from-brand-gold-400 to-brand-gold-500 text-white text-xs font-medium rounded-full">
            PREMIUM
          </span>
        )}

        {/* Spa Name Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-semibold text-white text-lg">{spa.name}</h3>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{spa.location?.address}, {spa.location?.city}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-brand-gold-400 fill-brand-gold-400" />
            <span className="font-medium text-gray-900">{spa.rating?.overall?.toFixed(1) || 'N/A'}</span>
            <span className="text-gray-400 text-sm">({spa.rating?.count || 0})</span>
          </div>
          <Link
            href={`/customer/book-new?spa=${spaId}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-maroon-500 text-white text-sm font-medium rounded-xl hover:bg-brand-maroon-600 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Book
          </Link>
        </div>
      </div>
    </div>
  );
}

function FavoritesContent() {
  const router = useRouter();
  const { user, firebaseUser, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const favorites = user?.customerData?.favorites || [];

  const removeFavoriteMutation = useMutation({
    mutationFn: async (spaId: string) => {
      if (!firebaseUser?.uid) throw new Error('Not authenticated');
      const db = getFirebaseFirestore();
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        'customerData.favorites': arrayRemove(spaId),
      });
    },
    onMutate: (spaId) => setRemovingId(spaId),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setRemovingId(null);
    },
    onError: () => setRemovingId(null),
  });

  return (
    <div className="min-h-screen bg-gray-50 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-95 transition-transform">
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="font-bold text-gray-900">Favorites</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="p-5">
        {favorites.length === 0 ? (
          <NoFavorites
            action={{
              label: 'Explore Spas',
              href: '/spas',
            }}
          />
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4">{favorites.length} saved spa{favorites.length !== 1 ? 's' : ''}</p>
            <div className="space-y-4">
              {favorites.map((spaId) => (
                <FavoriteSpaCard
                  key={spaId}
                  spaId={spaId}
                  onRemove={(id) => removeFavoriteMutation.mutate(id)}
                  isRemoving={removingId === spaId}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <ProtectedRoute requiredRoles={['customer']}>
      <FavoritesContent />
    </ProtectedRoute>
  );
}
