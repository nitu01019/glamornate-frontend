'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Star, Clock, ArrowLeft, IndianRupee, CheckCircle, Heart, Scissors, Droplet, Gem, ArrowRight, type LucideIcon } from 'lucide-react';
import { getFirebaseClient } from '@/lib/firebase-client-wrapper';
import type { Service, Spa } from '@/types';

type ServiceWithId = Service & { id: string };
type SpaWithId = Spa & { id: string };

const categoryInfo: Record<string, { name: string; icon: LucideIcon; bg: string; text: string }> = {
  massage: { name: 'Massage', icon: Clock, bg: 'bg-emerald-50', text: 'text-emerald-600' },
  facial: { name: 'Facial', icon: Droplet, bg: 'bg-pink-50', text: 'text-pink-600' },
  body: { name: 'Body', icon: Gem, bg: 'bg-purple-50', text: 'text-purple-600' },
  wellness: { name: 'Wellness', icon: Sparkles, bg: 'bg-blue-50', text: 'text-blue-600' },
  manicure: { name: 'Manicure', icon: Scissors, bg: 'bg-brand-maroon-50', text: 'text-brand-maroon-600' },
  pedicure: { name: 'Pedicure', icon: Scissors, bg: 'bg-brand-gold-50', text: 'text-brand-gold-600' },
};

export default function PublicServiceDetailClientPage({ id }: { id: string }) {
  const serviceId = id;

  const { data: service, isLoading, error } = useQuery<ServiceWithId | undefined, Error>({
    queryKey: ['service', serviceId],
    queryFn: async () => {
      const { serviceCatalogService } = await getFirebaseClient();
      const services = await serviceCatalogService.getServices() as ServiceWithId[];
      return services.find(s => s.id === serviceId || s.slug === serviceId);
    },
    enabled: !!serviceId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: spas } = useQuery<SpaWithId[]>({
    queryKey: ['spas-for-service', serviceId],
    queryFn: async () => {
      const { spaService } = await getFirebaseClient();
      const allSpas = await spaService.getSpas() as SpaWithId[];
      return allSpas.filter(spa => spa.isActive && spa.categories.includes(service!.category));
    },
    enabled: !!service,
    staleTime: 1000 * 60 * 5,
  });

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-maroon-50/30 to-white">
        <header className="border-b border-brand-maroon-100/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Link href="/services" className="flex items-center gap-2 text-brand-maroon-700 hover:text-brand-gold-600">
              <ArrowLeft className="w-4 h-4" />
              Back to Services
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-16 bg-brand-maroon-50 rounded animate-pulse mb-4" />
              <div className="h-48 bg-brand-maroon-50/50 rounded-2xl animate-pulse" />
              <div className="h-32 bg-brand-maroon-50/30 rounded-lg animate-pulse" />
            </div>
            <div className="h-80 bg-brand-maroon-50 rounded-2xl animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error || !service) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-maroon-50/30 to-white flex items-center justify-center">
        <Card className="border-brand-maroon-200 max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-brand-maroon-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Scissors className="w-8 h-8 text-brand-maroon-500" />
            </div>
            <h2 className="text-xl font-semibold text-brand-maroon-800 mb-2">Service not found</h2>
            <p className="text-brand-maroon-600 mb-4">The service you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            <Link href="/services">
              <Button className="bg-gradient-to-r from-brand-gold-600 to-brand-maroon-600 text-white">
                Browse Services
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const category = categoryInfo[service.category] || categoryInfo.massage;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-maroon-50/30 to-white">
      {/* Header */}
      <header className="border-b border-brand-maroon-100/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/services" className="flex items-center gap-2 text-brand-maroon-700 hover:text-brand-gold-600">
            <ArrowLeft className="w-4 h-4" />
            Back to Services
          </Link>
          <Button variant="ghost" size="icon" className="text-brand-maroon-400 hover:text-brand-maroon-500">
            <Heart className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Header */}
            <div className="flex items-start justify-between">
              <div>
                <Badge className={`${category.bg} ${category.text} border-none mb-3`}>
                  {category.name}
                </Badge>
                <h1 className="text-3xl md:text-4xl font-serif font-semibold text-brand-maroon-800 mb-2">
                  {service.name}
                </h1>
                <div className="flex items-center gap-4 text-slate-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{service.baseDuration} min</span>
                  </div>
                  {(service.durationVariants || []).length > 0 && (
                    <span className="text-sm text-slate-400">
                      Available: {(service.durationVariants || []).join(', ')} min
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-serif font-bold text-brand-gold-600 flex items-center justify-end gap-1">
                  <IndianRupee className="w-6 h-6" />
                  {service.basePrice}
                </div>
                <div className="text-sm text-brand-maroon-700/50">Starting price</div>
              </div>
            </div>

            {/* Service Description */}
            <Card className="border-brand-maroon-100">
              <CardContent className="p-6">
                <p className="text-slate-700 leading-relaxed text-lg">{service.description}</p>
              </CardContent>
            </Card>

            {/* Benefits */}
            {(service.benefits || []).length > 0 && (
              <Card className="border-brand-maroon-100">
                <CardContent className="p-6">
                  <h2 className="text-xl font-serif font-semibold text-brand-maroon-800 mb-4">Benefits</h2>
                  <div className="grid md:grid-cols-2 gap-3">
                    {(service.benefits || []).map((benefit, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <span className="text-slate-700">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* What to Expect */}
            <Card className="border-brand-maroon-100">
              <CardContent className="p-6">
                <h2 className="text-xl font-serif font-semibold text-brand-maroon-800 mb-4">What to Expect</h2>
                <div className="space-y-4 text-slate-600">
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full ${category.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className="font-bold text-slate-800">1</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-brand-maroon-800">Arrival & Consultation</h3>
                      <p className="text-sm mt-1">Arrive 10 minutes early for a brief consultation with your therapist.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full ${category.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className="font-bold text-slate-800">2</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-brand-maroon-800">The Experience</h3>
                      <p className="text-sm mt-1">Enjoy a relaxing {service.baseDuration}-minute session tailored to your needs.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full ${category.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className="font-bold text-slate-800">3</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-brand-maroon-800">Aftercare</h3>
                      <p className="text-sm mt-1">Post-treatment recommendations to maximize the benefits.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add-ons */}
            {(service.addOns || []).length > 0 && (
              <Card className="border-brand-maroon-100">
                <CardContent className="p-6">
                  <h2 className="text-xl font-serif font-semibold text-brand-maroon-800 mb-4">Available Add-ons</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {(service.addOns || []).map((addOn, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-brand-maroon-50 rounded-lg">
                        <div>
                          <div className="font-medium text-brand-maroon-800">{addOn.name}</div>
                          <div className="text-xs text-slate-500">+{addOn.duration} min</div>
                        </div>
                        <div className="text-brand-gold-600 font-semibold">
                          +{IndianRupee && <IndianRupee className="inline w-3 h-3" />}
                          {addOn.price}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Available Spas */}
            <Card className="border-brand-maroon-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-serif font-semibold text-brand-maroon-800">Available At</h2>
                  <Link href={`/spas?category=${service.category}`}>
                    <Button variant="ghost" className="text-brand-maroon-600">
                      View All <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {spas && spas.length > 0 ? (
                    spas.slice(0, 4).map((spa) => (
                      <Link key={spa.id} href={`/spas/${spa.id}`}>
                        <Card className="border-brand-maroon-100 hover:border-brand-gold-300 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-16 h-16 bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-6 h-6 text-brand-maroon-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-brand-maroon-800 truncate">{spa.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                  <span>{spa.location.city}</span>
                                  <span>•</span>
                                  <div className="flex items-center gap-1">
                                    <Star className="w-3 h-3 text-brand-gold-500 fill-brand-gold-500" />
                                    <span>{spa.rating.overall.toFixed(1)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8 text-slate-500">
                      <p>No spas currently offering this service</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* FAQ */}
            <Card className="border-brand-maroon-100">
              <CardContent className="p-6">
                <h2 className="text-xl font-serif font-semibold text-brand-maroon-800 mb-4">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-brand-maroon-800 mb-2">How long does the treatment take?</h3>
                    <p className="text-sm text-slate-600">
                      The standard duration is {service.baseDuration} minutes. We also offer appointments in {service.durationVariants?.join(', ') || 'custom'} minute increments.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium text-brand-maroon-800 mb-2">Should I arrive early?</h3>
                    <p className="text-sm text-slate-600">
                      Yes, we recommend arriving 10-15 minutes early to complete any required paperwork and enjoy a complimentary beverage.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium text-brand-maroon-800 mb-2">What should I wear?</h3>
                    <p className="text-sm text-slate-600">
                      We provide robes and towels. For your comfort, we recommend comfortable clothing.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Quick Book Card */}
            <Card className="border-brand-gold-200 bg-gradient-to-br from-brand-gold-50 to-brand-maroon-50 sticky top-24">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <div className="text-4xl font-serif font-bold text-brand-gold-600 flex items-center justify-center gap-1 mb-2">
                    <IndianRupee className="w-6 h-6" />
                    {service.basePrice}
                  </div>
                  <div className="text-sm text-brand-maroon-700/50">Starting from</div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Duration</span>
                    <span className="text-slate-800">{service.baseDuration} minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Category</span>
                    <span className="text-slate-800 capitalize">{service.category}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Recommended</span>
                    <span className="text-slate-800 capitalize">{service.recommendedFor}</span>
                  </div>
                </div>

                <Link href={`/spas?category=${service.category}`}>
                  <Button className="w-full mt-6 bg-gradient-to-r from-brand-gold-600 to-brand-maroon-600 hover:from-brand-gold-700 hover:to-brand-maroon-700 text-white">
                    Find Spas
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>

                <p className="text-center text-xs text-brand-maroon-700/50 mt-4">
                  Prices may vary by spa and location
                </p>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card className="border-brand-maroon-100">
              <CardContent className="p-6">
                <h3 className="font-semibold text-brand-maroon-800 mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {(service.tags || []).map((tag, i) => (
                    <Badge key={i} className="bg-brand-maroon-50 text-brand-maroon-700 border-none">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Related Services */}
            <Card className="border-brand-maroon-100">
              <CardContent className="p-6">
                <h3 className="font-semibold text-brand-maroon-800 mb-4">Similar Services</h3>
                <p className="text-sm text-slate-500">
                  Check out other {category.name.toLowerCase()} services
                </p>
                <Link href={`/services?category=${service.category}`}>
                  <Button variant="outline" className="w-full mt-4">
                    Browse {category.name}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
