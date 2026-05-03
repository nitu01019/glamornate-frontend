'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles, Search, Scissors, Droplet, Gem, Clock, ArrowRight, IndianRupee } from 'lucide-react';
import { initializeFirebase, getFirebaseClient } from '@/lib/firebase-client-wrapper';
import { isFirebaseConfigured } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import type { Service } from '@/types';

// Extended service type with id for client-side use
interface ServiceWithId extends Service {
  id: string;
}

const categories = [
  { id: 'all', name: 'All Services', icon: Sparkles, description: 'Browse all services' },
  { id: 'massage', name: 'Massage', icon: Scissors, description: 'Therapeutic & relaxing massages' },
  { id: 'facial', name: 'Facial', icon: Droplet, description: 'Skin care treatments' },
  { id: 'body', name: 'Body', icon: Gem, description: 'Body treatments & wraps' },
  { id: 'wellness', name: 'Wellness', icon: Sparkles, description: 'Holistic wellness sessions' },
  { id: 'manicure', name: 'Manicure', icon: Scissors, description: 'Nail & hand care' },
  { id: 'pedicure', name: 'Pedicure', icon: Scissors, description: 'Foot care treatments' },
];

const categoryColors: Record<string, { bg: string; icon: string }> = {
  massage: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
  facial: { bg: 'bg-pink-50', icon: 'text-pink-600' },
  body: { bg: 'bg-purple-50', icon: 'text-purple-600' },
  wellness: { bg: 'bg-blue-50', icon: 'text-blue-600' },
  manicure: { bg: 'bg-brand-maroon-50', icon: 'text-brand-maroon-600' },
  pedicure: { bg: 'bg-brand-gold-50', icon: 'text-brand-gold-600' },
};

export default function ServicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { user, isAuthenticated: rawIsAuth } = useAuth();

  // Defer auth to client-only to prevent SSR hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  const isAuthenticated = hasMounted ? rawIsAuth : false;

  // Initialize Firebase on client mount only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeFirebase().catch((err: unknown) => logger.error('Firebase init failed', err, { component: 'public/services' }));
    }
  }, []);

  const { data: services, isLoading, error } = useQuery<ServiceWithId[], Error>({
    queryKey: ['services', selectedCategory],
    queryFn: async () => {
      if (!isFirebaseConfigured()) {
        return [];
      }
      const firebaseClient = await getFirebaseClient();
      const result = await firebaseClient.serviceCatalogService.getServices();
      return result.filter(s => s.isActive) as ServiceWithId[];
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const filteredServices = services
    ?.filter((service) => {
      const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
      const matchesSearch = !searchQuery ||
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    }) || [];

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-maroon-50/30 to-white">
        <header className="border-b border-brand-maroon-100/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-brand-gold-600" />
              <span className="text-xl font-serif font-semibold bg-gradient-to-r from-brand-gold-700 to-brand-maroon-600 bg-clip-text text-transparent">
                Glamornate
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-brand-maroon-800/70 hover:text-brand-gold-600">Home</Link>
              <Link href="/spas" className="text-brand-maroon-800/70 hover:text-brand-gold-600">Find Spas</Link>
              <Link href="/services" className="text-brand-gold-600 font-medium">Services</Link>
            </nav>
            <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                <Link href="/customer/dashboard" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-maroon-400 to-brand-gold-400 flex items-center justify-center text-white text-sm font-medium shadow-md">
                    {user.profile?.displayName?.charAt(0) || 'U'}
                  </div>
                  <span className="text-sm font-medium text-brand-maroon-700 hidden lg:block">
                    {user.profile?.displayName?.split(' ')[0] || 'User'}
                  </span>
                </Link>
              ) : (
                <>
                  <Link href="/auth/login"><Button variant="ghost" className="text-brand-maroon-700">Sign In</Button></Link>
                  <Link href="/auth/register"><Button className="bg-gradient-to-r from-brand-gold-600 to-brand-maroon-600 text-white">Get Started</Button></Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="text-center mb-12">
            <div className="h-10 bg-brand-maroon-50 rounded w-64 mx-auto mb-4 animate-pulse" />
            <div className="h-6 bg-brand-maroon-50 rounded w-96 mx-auto animate-pulse" />
          </div>

          <div className="max-w-xl mx-auto mb-12 h-12 bg-brand-maroon-50 rounded-lg animate-pulse" />

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {categories.map((_, i) => (
              <div key={i} className="h-28 w-36 bg-brand-maroon-50 rounded-2xl animate-pulse" />
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-brand-maroon-100 h-80 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-maroon-50/30 to-white flex items-center justify-center">
        <Card className="border-brand-maroon-200 max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-brand-maroon-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-brand-maroon-500" />
            </div>
            <h2 className="text-xl font-semibold text-brand-maroon-800 mb-2">Unable to load services</h2>
            <p className="text-brand-maroon-600 mb-4">Please check your connection and try again.</p>
            <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-brand-gold-600 to-brand-maroon-600 text-white">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-maroon-50/30 to-white">
      {/* Header */}
      <header className="border-b border-brand-maroon-100/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-gold-600" />
            <span className="text-xl font-serif font-semibold bg-gradient-to-r from-brand-gold-700 to-brand-maroon-600 bg-clip-text text-transparent">
              Glamornate
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-brand-maroon-800/70 hover:text-brand-gold-600">Home</Link>
            <Link href="/spas" className="text-brand-maroon-800/70 hover:text-brand-gold-600">Find Spas</Link>
            <Link href="/services" className="text-brand-gold-600 font-medium">Services</Link>
          </nav>
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <Link href="/customer/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-maroon-400 to-brand-gold-400 flex items-center justify-center text-white text-sm font-medium shadow-md">
                  {user.profile?.displayName?.charAt(0) || 'U'}
                </div>
                <span className="text-sm font-medium text-brand-maroon-700 hidden lg:block">
                  {user.profile?.displayName?.split(' ')[0] || 'User'}
                </span>
              </Link>
            ) : (
              <>
                <Link href="/auth/login"><Button variant="ghost" className="text-brand-maroon-700">Sign In</Button></Link>
                <Link href="/auth/register"><Button className="bg-gradient-to-r from-brand-gold-600 to-brand-maroon-600 text-white">Get Started</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold mb-4 bg-gradient-to-r from-brand-maroon-700 to-brand-gold-600 bg-clip-text text-transparent">
            Our Services
          </h1>
          <p className="text-brand-maroon-700/70 text-lg max-w-2xl mx-auto">
            Explore our range of premium beauty and wellness services
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-maroon-400" />
            <Input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 h-12 border-brand-maroon-200 text-lg shadow-lg"
            />
          </div>
        </div>

        {/* Results count */}
        <p className="text-center text-brand-maroon-700/60 text-sm mb-10">
          {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} found
        </p>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all min-w-[140px] ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-br from-brand-gold-500 to-brand-maroon-500 text-white shadow-xl shadow-brand-gold-500/20 scale-105'
                  : 'bg-white border border-brand-maroon-100 text-brand-maroon-800 hover:border-brand-gold-200 hover:shadow-md'
              }`}
            >
              <category.icon className="w-8 h-8" />
              <span className="font-medium text-sm">{category.name}</span>
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => {
            const colors = categoryColors[service.category] || { bg: 'bg-gray-50', icon: 'text-gray-600' };
            return (
              <Card key={service.id} className="overflow-hidden border-brand-maroon-100 hover:shadow-xl hover:shadow-brand-maroon-100/30 transition-all group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colors.bg}`}>
                      <span className="text-2xl">{service.icon}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-serif font-bold text-brand-gold-600 flex items-center justify-end gap-1">
                        <IndianRupee className="w-5 h-5" />
                        {service.basePrice}
                      </div>
                      <div className="text-xs text-brand-maroon-700/50">from</div>
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg text-brand-maroon-800 mb-2 group-hover:text-brand-gold-600 transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-sm text-brand-maroon-700/60 mb-4 line-clamp-2">{service.description}</p>

                  <div className="flex items-center gap-1 text-sm text-brand-maroon-700/60 mb-3">
                    <Clock className="w-4 h-4" />
                    <span>{service.baseDuration} min</span>
                    {(service.durationVariants || []).length > 1 && (
                      <span className="text-xs text-brand-maroon-700/40">(available: {(service.durationVariants || []).join(', ')} min)</span>
                    )}
                  </div>

                  {(service.benefits || []).length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        {(service.benefits || []).slice(0, 3).map((benefit) => (
                          <span key={benefit} className="text-xs bg-brand-maroon-50 text-brand-maroon-600 px-2 py-1 rounded-full">
                            {benefit}
                          </span>
                        ))}
                        {(service.benefits || []).length > 3 && (
                          <span className="text-xs text-brand-maroon-500">+{(service.benefits || []).length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {(service.addOns || []).length > 0 && (
                    <div className="mb-4 text-xs text-brand-maroon-700/50">
                      Add-ons available: {(service.addOns || []).map(a => a.name).join(', ')}
                    </div>
                  )}

                  <Link href={`/spas?category=${service.category}&service=${service.id}`}>
                    <Button className="w-full bg-gradient-to-r from-brand-gold-600 to-brand-maroon-600 hover:from-brand-gold-700 hover:to-brand-maroon-700 text-white">
                      Find Spas
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredServices.length === 0 && (
          <Card className="border-dashed border-brand-maroon-200">
            <CardContent className="p-12 text-center">
              <Search className="w-16 h-16 text-brand-maroon-200 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-brand-maroon-800 mb-2">No services found</h3>
              <p className="text-brand-maroon-600/60">Try adjusting your search or category filter</p>
            </CardContent>
          </Card>
        )}

        {/* Popular Services */}
        <div className="mt-16">
          <h2 className="text-2xl font-serif font-semibold text-center mb-8 text-brand-maroon-800">
            Most Booked This Week
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {['Haircut & Styling', 'Aromatherapy Massage', 'Signature Facial', 'Manicure & Pedicure'].map((name, i) => (
              <Card key={name} className="border-brand-gold-200 bg-gradient-to-br from-brand-gold-50 to-brand-maroon-50">
                <CardContent className="p-4 text-center">
                  <div className="w-8 h-8 bg-brand-gold-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="font-bold text-brand-gold-700">{i + 1}</span>
                  </div>
                  <div className="font-medium text-brand-maroon-800 text-sm">{name}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-maroon-100 bg-brand-maroon-50/30 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-brand-maroon-700/60">
          <p>© 2026 Glamornate. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
