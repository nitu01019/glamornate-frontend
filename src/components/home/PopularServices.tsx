'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePopularServices } from '@/hooks/useServices';
import { isFirebaseConfigured } from '@/lib/firebase';
import { ServiceCardSkeleton } from './Skeletons';
import { ChevronRight, Sparkles, Clock } from 'lucide-react';

const DEMO_SERVICES = [
  {
    id: 'demo-s1',
    name: 'Swedish Massage',
    category: 'massage',
    baseDuration: 60,
    basePrice: 2500,
    icon: '',
    images: [],
  },
  {
    id: 'demo-s2',
    name: 'Deep Tissue',
    category: 'massage',
    baseDuration: 90,
    basePrice: 3500,
    icon: '',
    images: [],
  },
  {
    id: 'demo-s3',
    name: 'Gold Facial',
    category: 'facial',
    baseDuration: 45,
    basePrice: 2000,
    icon: '',
    images: [],
  },
  {
    id: 'demo-s4',
    name: 'Hair Spa',
    category: 'hair',
    baseDuration: 60,
    basePrice: 1800,
    icon: '',
    images: [],
  },
  {
    id: 'demo-s5',
    name: 'Aromatherapy',
    category: 'aromatherapy',
    baseDuration: 75,
    basePrice: 3000,
    icon: '',
    images: [],
  },
];

export default function PopularServices() {
  const { data: popularServices, isLoading } = usePopularServices();
  const isDemoMode = !isFirebaseConfigured();
  const displayServices = popularServices && popularServices.length > 0 ? popularServices : (isDemoMode ? DEMO_SERVICES : []);

  return (
    <section className="py-6 bg-white">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Recommended Services
        </h2>
        <Link
          href="/services"
          className="flex items-center gap-1 text-brand-maroon-600 text-sm font-medium"
        >
          See All
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex overflow-x-auto gap-3 px-4 pb-2 scrollbar-hide snap-x-mandatory scroll-smooth">
        {isLoading ? (
          <>
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
          </>
        ) : displayServices.length > 0 ? (
          displayServices.slice(0, 10).map(service => (
            <Link
              key={service.id}
              href={isDemoMode ? '#' : `/services?category=${service.category}`}
              className="w-[160px] flex-shrink-0 snap-start"
            >
              <div className="bg-gray-50 rounded-2xl overflow-hidden hover:shadow-sm transition-shadow">
                <div className="relative h-28 bg-gradient-to-br from-brand-maroon-100 to-brand-gold-100">
                  {service.images?.[0] ? (
                    <Image
                      src={service.images[0]}
                      alt={service.name}
                      fill
                      className="object-cover"
                      sizes="160px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-brand-maroon-300" />
                    </div>
                  )}
                  {isDemoMode && (
                    <div className="absolute top-2 right-2 bg-brand-gold-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-semibold shadow">
                      Demo
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">
                    {service.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {service.baseDuration}min
                    </span>
                    <span className="text-xs font-semibold text-brand-gold-600">
                      ₹{service.basePrice?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="w-full text-center py-8 text-gray-500">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No services available yet</p>
          </div>
        )}
      </div>
    </section>
  );
}
