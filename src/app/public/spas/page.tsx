'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useLocation } from '@/lib/location-provider';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Search, MapPin, Star, Clock, Filter, Building2, Car, DollarSign, type LucideIcon } from 'lucide-react';
import { initializeFirebase, getFirebaseClient } from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import type { Spa } from '@/types';

type SpaWithId = Spa & { id: string };

const categories = [
  { id: 'all', name: 'All Services', icon: Sparkles },
  { id: 'massage', name: 'Massage', icon: Clock },
  { id: 'facial', name: 'Facial', icon: Sparkles },
  { id: 'body', name: 'Body', icon: Filter },
  { id: 'wellness', name: 'Wellness', icon: Sparkles },
  { id: 'manicure', name: 'Manicure', icon: Sparkles },
  { id: 'pedicure', name: 'Pedicure', icon: Sparkles },
];

const priceRanges = [
  { id: 'all', label: 'All Prices', min: 0, max: Infinity },
  { id: 'budget', label: 'Budget', min: 0, max: 1500 },
  { id: 'mid', label: 'Mid-Range', min: 1500, max: 3000 },
  { id: 'premium', label: 'Premium', min: 3000, max: Infinity },
];

const tiers = [
  { id: 'all', label: 'All Tiers' },
  { id: 'premium', label: 'Premium' },
  { id: 'partner', label: 'Partner' },
  { id: 'basic', label: 'Basic' },
];

const spaImages = [
  'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=600',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600',
  'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=600',
  'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600',
  'https://images.unsplash.com/photo-151697508158125-c6329e482610?w=600',
  'https://images.unsplash.com/photo-1515374810703-860b608a4259?w=600',
];

export default function SpasPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');
  const { location: rawLocation } = useLocation();
  const { user, isAuthenticated: rawIsAuth } = useAuth();

  // Defer client-only state to prevent SSR hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  // F6: defer `new Date()` weekday resolution to post-mount to avoid SSR/CSR drift.
  const [todayWeekday, setTodayWeekday] = useState<string | null>(null);
  useEffect(() => {
    setHasMounted(true);
    setTodayWeekday(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase());
  }, []);
  const location = hasMounted ? rawLocation : null;
  const isAuthenticated = hasMounted ? rawIsAuth : false;

  // Initialize Firebase on client mount only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeFirebase().catch((err: unknown) => logger.error('Firebase init failed', err, { component: 'public/spas' }));
    }
  }, []);

  const { data: spas, isLoading, error } = useQuery<SpaWithId[], Error>({
    queryKey: ['spas', location?.city ?? 'all'],
    queryFn: async () => {
      if (!isFirebaseConfigured()) {
        return [];
      }
      const firebaseClient = await getFirebaseClient();
      const result = await firebaseClient.spaService.getSpas() as SpaWithId[];
      const activeSpas = result.filter(spa => spa.isActive);
      // Filter by detected city when available
      if (location?.city) {
        return activeSpas.filter(
          spa => spa.location?.city?.toLowerCase() === location.city.toLowerCase()
        );
      }
      return activeSpas;
    },
    staleTime: 1000 * 60 * 5,
  });

  const getFilteredSpas = () => {
    if (!spas) return [];
    return spas.filter((spa) => {
      const matchesSearch = spa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           spa.location.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (spa.searchIndex?.toLowerCase().includes(searchQuery.toLowerCase()) || false);

      const matchesCategory = selectedCategory === 'all' || (spa.categories as unknown as string[])?.includes(selectedCategory);

      const matchesPrice = selectedPriceRange === 'all' ||
        (spa.statistics?.revenue >= (priceRanges.find(p => p.id === selectedPriceRange)?.min ?? 0) &&
         spa.statistics?.revenue < (priceRanges.find(p => p.id === selectedPriceRange)?.max ?? Infinity));

      const matchesTier = selectedTier === 'all' || spa.tier === selectedTier;
      return matchesSearch && matchesCategory && matchesPrice && matchesTier;
    });
  };

  const filteredSpas = getFilteredSpas();

  const getSpaImage = (index: number) => spaImages[index % spaImages.length];

  const isOpenToday = (spa: SpaWithId) => {
    if (todayWeekday === null) return false;
    return spa.operatingHours?.[todayWeekday as keyof typeof spa.operatingHours]?.isOpen ?? false;
  };

  const getAmenitiesIcon = (amenity: string) => {
    const icons: Record<string, LucideIcon> = {
      wifi: Building2,
      ac: Sparkles,
      parking: Car,
      shower: Filter,
    };
    return icons[amenity] || Sparkles;
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-maroon-500 to-brand-gold-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-semibold text-slate-800">Glamornate</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-slate-600 hover:text-brand-maroon-600">Home</Link>
              <Link href="/spas" className="text-brand-maroon-600 font-medium">Find Spas</Link>
              <Link href="/services" className="text-slate-600 hover:text-brand-maroon-600">Services</Link>
            </nav>
            <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                <Link href="/customer/dashboard" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-maroon-400 to-brand-gold-400 flex items-center justify-center text-white text-sm font-medium shadow-md">
                    {user.profile?.displayName?.charAt(0) || 'U'}
                  </div>
                  <span className="text-sm font-medium text-slate-700 hidden lg:block">
                    {user.profile?.displayName?.split(' ')[0] || 'User'}
                  </span>
                </Link>
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button variant="ghost" className="text-slate-600">Sign In</Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button className="bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
              Discover Premium Spas
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Find the perfect spa for your next wellness experience{location?.city ? ` in ${location.city}` : ''}
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-8 h-12 bg-slate-100 rounded-lg animate-pulse" />
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {categories.map((_, i) => (
              <div key={i} className="w-24 h-10 bg-slate-100 rounded-full animate-pulse" />
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-slate-200 h-80 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Card className="border-slate-200 max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-brand-maroon-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-brand-maroon-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to load spas</h2>
            <p className="text-slate-500 mb-4">Please check your connection and try again.</p>
            <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-maroon-500 to-brand-gold-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-800">Glamornate</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-slate-600 hover:text-brand-maroon-600">Home</Link>
            <Link href="/spas" className="text-brand-maroon-600 font-medium">Find Spas</Link>
            <Link href="/services" className="text-slate-600 hover:text-brand-maroon-600">Services</Link>
          </nav>
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <Link href="/customer/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-maroon-400 to-brand-gold-400 flex items-center justify-center text-white text-sm font-medium shadow-md">
                  {user.profile?.displayName?.charAt(0) || 'U'}
                </div>
                <span className="text-sm font-medium text-slate-700 hidden lg:block">
                  {user.profile?.displayName?.split(' ')[0] || 'User'}
                </span>
              </Link>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" className="text-slate-600">Sign In</Button>
                </Link>
                <Link href="/auth/register">
                  <Button className="bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
            Discover Premium Spas
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Find the perfect spa for your next wellness experience{location?.city ? ` in ${location.city}` : ''}
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search spas by name, location, or services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 h-12 border-slate-200 shadow-md"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-brand-maroon-300'
              }`}
            >
              <category.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <Card className="border-slate-200 sticky top-24">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Filter className="w-5 h-5 text-slate-500" />
                  <h3 className="font-semibold text-slate-800">Filters</h3>
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Price Range</h4>
                  <div className="space-y-2">
                    {priceRanges.map((range) => (
                      <button
                        key={range.id}
                        onClick={() => setSelectedPriceRange(range.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedPriceRange === range.id
                            ? 'bg-brand-maroon-50 text-brand-maroon-700 font-medium'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tier */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Tier</h4>
                  <div className="space-y-2">
                    {tiers.map((tier) => (
                      <button
                        key={tier.id}
                        onClick={() => setSelectedTier(tier.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedTier === tier.id
                            ? 'bg-brand-maroon-50 text-brand-maroon-700 font-medium'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Minimum Rating</h4>
                  <div className="space-y-2">
                    {[4.5, 4.0, 3.5, 3.0].map((rating) => (
                      <label key={rating} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded border-slate-300 text-brand-maroon-500 focus:ring-brand-maroon-500" />
                        <div className="flex items-center text-brand-gold-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="text-sm text-slate-700 ml-1">{rating}+</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <Button className="w-full mt-6 bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white">
                  Apply Filters
                </Button>
              </CardContent>
            </Card>
          </aside>

          {/* Spa List */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <p className="text-slate-500">
                {filteredSpas.length} {filteredSpas.length === 1 ? 'spa' : 'spas'} found
              </p>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
                <option>Sort by: Recommended</option>
                <option>Rating: High to Low</option>
                <option>Rating: Low to High</option>
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {filteredSpas.map((spa, index) => {
                const spaImage = spa.featuredImage || getSpaImage(index);
                return (
                  <Link key={spa.id} href={`/spas/${spa.id}`}>
                    <Card className="overflow-hidden border-slate-200 hover:shadow-xl hover:shadow-brand-maroon-100/30 transition-all group cursor-pointer h-full">
                      <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
                        <Image
                          src={spaImage}
                          alt={spa.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-3">
                          <Badge className={
                            spa.tier === 'premium'
                              ? 'bg-brand-gold-500 text-white border-none'
                            : spa.tier === 'partner'
                            ? 'bg-blue-500 text-white border-none'
                            : 'bg-slate-500 text-white border-none'
                          }>
                            {spa.tier.toUpperCase()}
                          </Badge>
                        </div>
                        {isOpenToday(spa) ? (
                          <span className="absolute top-3 right-3 px-3 py-1 bg-emerald-500 text-white text-xs rounded-full font-medium">
                            Open Now
                          </span>
                        ) : (
                          <span className="absolute top-3 right-3 px-3 py-1 bg-slate-500 text-white text-xs rounded-full font-medium">
                            Closed
                          </span>
                        )}
                      </div>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-lg text-slate-800 group-hover:text-brand-maroon-600 transition-colors">
                            {spa.name}
                          </h3>
                          <div className="flex items-center gap-1 bg-brand-gold-50 px-2 py-1 rounded-lg">
                            <Star className="w-4 h-4 text-brand-gold-500 fill-current" />
                            <span className="font-medium text-brand-gold-700">{spa.rating?.overall || 0}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 mb-3">{spa.shortDescription || ''}</p>
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                          <MapPin className="w-4 h-4" />
                          {spa.location.city}, {spa.location.state}
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                          {(spa.amenities || []).slice(0, 3).map((amenity) => {
                            const Icon = getAmenitiesIcon(amenity);
                            return (
                              <div key={amenity} className="flex items-center gap-1 text-xs text-slate-500">
                                <Icon className="w-3 h-3" />
                                <span className="capitalize">{amenity}</span>
                              </div>
                            );
                          })}
                          {spa.amenities && spa.amenities.length > 3 && (
                            <span className="text-xs text-slate-400">+{spa.amenities.length - 3} more</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <span>{spa.rating?.count || 0} reviews</span>
                          {spa.tier === 'premium' && (
                            <div className="flex items-center gap-1 text-brand-gold-500">
                              <DollarSign className="w-3 h-3" />
                              <span>Premium</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {filteredSpas.length === 0 && (
              <Card className="border-slate-200 border-dashed">
                <CardContent className="p-12 text-center">
                  <Search className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No spas found</h3>
                  <p className="text-slate-500">Try adjusting your filters or search terms</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
