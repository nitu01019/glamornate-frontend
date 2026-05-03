'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Star, MapPin, Phone, Calendar, ArrowLeft, IndianRupee, CheckCircle, Heart, Share2, Wifi, Car, Music, Utensils, Package } from 'lucide-react';
import { firebaseClientWrapper } from '@/lib/firebase-client-wrapper';
import { useAuth } from '@/lib/auth-provider';
import { useReviews } from '@/hooks/useApi';
import type { Spa } from '@/types';

type SpaWithId = Spa & { id: string };

const amenityIcons: Record<string, React.ElementType> = {
  wifi: Wifi,
  ac: Sparkles,
  parking: Car,
  music: Music,
  refreshments: Utensils,
  locker: Package,
  shower: Sparkles,
};

export default function PublicSpaDetailClientPage({ id }: { id: string }) {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const spaId = id;
  // F6: defer `new Date()` to post-mount to avoid SSR/CSR hydration drift.
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [todayWeekday, setTodayWeekday] = useState<string | null>(null);
  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setTodayWeekday(new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase());
  }, []);

  // CRIT-006: Fetch single document by ID instead of fetching all spas
  const { data: spa, isLoading, error } = useQuery<SpaWithId | null, Error>({
    queryKey: ['spa', spaId],
    queryFn: async () => {
      try {
        // MED-004: getDocument handles unconfigured Firebase gracefully (returns null)
        const result = await firebaseClientWrapper.getDocument<Spa>('spas', spaId);
        if (!result) return null;
        return { id: result.id, ...result.data };
      } catch {
        return null;
      }
    },
    enabled: !!spaId,
    staleTime: 1000 * 60 * 5,
  });

  // CRIT-004: Fetch real reviews from Firebase
  const { data: reviews = [], isLoading: reviewsLoading } = useReviews(spaId);

  // CRIT-005: Book Now handler
  const handleBookNow = () => {
    if (!firebaseUser) {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/public/spas/${spaId}`)}`);
      return;
    }
    router.push(`/customer/book-new?spaId=${spaId}`);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/spas" className="flex items-center gap-2 text-slate-600 hover:text-brand-maroon-600">
              <ArrowLeft className="w-4 h-4" />
              Back to Spas
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="h-80 bg-slate-100 rounded-2xl animate-pulse mb-8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-8 bg-slate-100 rounded w-3/4 animate-pulse" />
              <div className="h-24 bg-slate-50 rounded animate-pulse" />
              <div className="grid md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            </div>
            <div className="h-96 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error || !spa) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Card className="border-slate-200 max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-brand-maroon-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-brand-maroon-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Spa not found</h2>
            <p className="text-slate-500 mb-4">The spa you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            <Link href="/spas">
              <Button className="bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white">
                Browse Spas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOpenToday = () => {
    if (todayWeekday === null) return false;
    return spa.operatingHours?.[todayWeekday]?.isOpen ?? false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/spas" className="flex items-center gap-2 text-slate-600 hover:text-brand-maroon-600">
            <ArrowLeft className="w-4 h-4" />
            Back to Spas
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-brand-maroon-500">
              <Heart className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-brand-maroon-500">
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Image */}
        <div className="relative h-80 md:h-96 -mx-4 md:mx-0 rounded-2xl overflow-hidden mb-8">
          {spa.featuredImage ? (
            <Image
              src={spa.featuredImage}
              alt={`${spa.name} featured image`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center gap-3 mb-3">
              <Badge className={
                spa.tier === 'premium'
                  ? 'bg-brand-gold-500 text-white border-none'
                  : spa.tier === 'partner'
                  ? 'bg-blue-500 text-white border-none'
                  : 'bg-slate-500 text-white border-none'
              }>
                {spa.tier.toUpperCase()}
              </Badge>
              {isOpenToday() ? (
                <Badge className="bg-emerald-500 text-white border-none flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Open Now
                </Badge>
              ) : (
                <Badge className="bg-slate-500 text-white border-none">Closed</Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{spa.name}</h1>
            <div className="flex items-center gap-2 text-white/90">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{spa.location.city}, {spa.location.state}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview */}
            <Card className="border-slate-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-brand-gold-500 fill-brand-gold-500" />
                    <span className="text-2xl font-bold text-slate-800">{spa.rating.overall.toFixed(1)}</span>
                    <span className="text-slate-500">({spa.rating.count} reviews)</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{spa.statistics.totalBookings} bookings</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <IndianRupee className="w-4 h-4" />
                      <span>{spa.statistics.revenue.toLocaleString()} revenue</span>
                    </div>
                  </div>
                </div>
                <p className="text-slate-600 leading-relaxed">{spa.description}</p>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="services" className="w-full">
              <TabsList className="bg-slate-100 border-slate-100">
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="therapists">Therapists</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
                <TabsTrigger value="gallery">Gallery</TabsTrigger>
              </TabsList>

              <TabsContent value="services" className="mt-6">
                <Card className="border-slate-100">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-800">Featured Services</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {spa.categories.map((category) => (
                      <div key={category} className="mb-4 p-4 bg-slate-50 rounded-lg">
                        <h3 className="font-semibold text-slate-800 capitalize">{category}</h3>
                        <p className="text-sm text-slate-500">Click to book appointments</p>
                      </div>
                    ))}
                    <Button className="w-full bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white">
                      View All Services
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="therapists" className="mt-6">
                <Card className="border-slate-100">
                  <CardContent className="p-6">
                    <p className="text-center text-slate-500 mb-4">
                      Browse our experienced therapists
                    </p>
                    <Button className="w-full bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white">
                      View Our Team
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CRIT-004: Real reviews from Firebase */}
              <TabsContent value="reviews" className="mt-6">
                <Card className="border-slate-100">
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <div className="text-5xl font-bold text-brand-maroon-600 mb-2">{spa.rating.overall.toFixed(1)}</div>
                      <div className="flex items-center justify-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-6 h-6 ${i <= Math.round(spa.rating.overall) ? 'text-brand-gold-500 fill-brand-gold-500' : 'text-slate-300'}`}
                          />
                        ))}
                      </div>
                      <p className="text-slate-500">Based on {spa.rating.count} reviews</p>
                    </div>

                    {reviewsLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : reviews.length === 0 ? (
                      <p className="text-center text-slate-500 py-4">No reviews yet. Be the first to review!</p>
                    ) : (
                      <div className="space-y-4">
                        {reviews.map((review) => (
                          <div key={review.id} className="border-b border-slate-100 pb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${i <= review.rating ? 'text-brand-gold-500 fill-brand-gold-500' : 'text-slate-300'}`}
                                  />
                                ))}
                                {review.title && (
                                  <span className="font-medium text-slate-800 ml-1">{review.title}</span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-slate-600">{review.comment}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="gallery" className="mt-6">
                <Card className="border-slate-100">
                  <CardContent className="p-6">
                    {spa.gallery && spa.gallery.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {spa.gallery.map((img, i) => (
                          <div key={i} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden">
                            <Image
                              src={img}
                              alt={`Gallery ${i}`}
                              fill
                              sizes="(max-width: 768px) 50vw, 33vw"
                              className="object-cover hover:scale-105 transition-transform"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-64 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg flex items-center justify-center">
                        <p className="text-slate-400">No images available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Amenities */}
            <Card className="border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Amenities</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {spa.amenities && spa.amenities.length > 0 ? (
                    spa.amenities.map((amenity) => {
                      const Icon = amenityIcons[amenity] || Sparkles;
                      return (
                        <div key={amenity} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-lg">
                          <Icon className="w-6 h-6 text-brand-maroon-600" />
                          <span className="text-sm text-slate-700 capitalize">{amenity}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="col-span-full text-center text-slate-500">Amenities information not available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Sidebar */}
          <aside>
            <Card className="border-brand-maroon-200 bg-gradient-to-br from-brand-maroon-50 to-brand-gold-50 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Book Appointment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Select Service</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {spa.categories.map((cat) => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                {/* CRIT-005: Time slots update selectedTime state */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Select Time</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['10:00', '11:00', '12:00', '14:00', '15:00', '16:00'].map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                          selectedTime === time
                            ? 'border-brand-maroon-500 bg-brand-maroon-50 text-brand-maroon-700 font-medium'
                            : 'border-slate-200 hover:border-brand-maroon-400 hover:bg-brand-maroon-50'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CRIT-005: Book Now with auth-aware navigation */}
                <Button
                  onClick={handleBookNow}
                  className="w-full bg-gradient-to-r from-brand-gold-600 to-brand-maroon-600 hover:from-brand-gold-700 hover:to-brand-maroon-700 text-white"
                >
                  {firebaseUser ? 'Book Now' : 'Login to Book'}
                </Button>

                <p className="text-center text-xs text-slate-500">
                  Free cancellation up to 24 hours before
                </p>
              </CardContent>
            </Card>

            {/* Contact Card */}
            <Card className="border-slate-100 mt-6">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{spa.location.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{spa.contact.phone}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Operating Hours</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(spa.operatingHours || {}).slice(0, 5).map(([day, hours]) => (
                      <div key={day} className="flex items-center justify-between">
                        <span className="text-slate-600 capitalize">{day}</span>
                        <span className="text-slate-800">
                          {hours.isOpen ? `${hours.open} - ${hours.close}` : 'Closed'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
