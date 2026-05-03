'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ShoppingBag, Sparkles } from 'lucide-react';
import {
  getCategoryBySlug,
  getSubcategoriesByCategory,
  catalogServices,
} from '@/data/glamornate-catalog';
import SubcategoryTabs from '@/components/catalog/SubcategoryTabs';
import ServiceList from '@/components/catalog/ServiceList';
import ServiceCardGrid from '@/components/catalog/ServiceCardGrid';
import { useCartStore } from '@/store/cart';

export default function CategoryDetailClientPage({ slug }: { slug: string }) {
  const router = useRouter();

  const category = getCategoryBySlug(slug);
  const subcategories = getSubcategoriesByCategory(slug);

  const [activeSubSlug, setActiveSubSlug] = useState<string>(
    subcategories.length > 0 ? subcategories[0].slug : '',
  );

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const storeItemCount = useCartStore((state) => state.getItemCount());
  const storeCartTotal = useCartStore((state) => state.getTotal());
  const openCart = useCartStore((state) => state.openCart);
  const itemCount = hasMounted ? storeItemCount : 0;
  const cartTotal = hasMounted ? storeCartTotal : 0;

  // Derive the active subcategory name from the slug
  const activeSubName = useMemo(() => {
    const found = subcategories.find((sc) => sc.slug === activeSubSlug);
    return found?.name ?? '';
  }, [subcategories, activeSubSlug]);

  const servicesForSubcategory = useMemo(() => {
    return catalogServices.filter(
      (s) => s.categorySlug === slug && s.subcategory === activeSubName,
    );
  }, [slug, activeSubName]);

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-maroon-50 mb-4">
          <Sparkles className="w-8 h-8 text-brand-maroon-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Category not found</h1>
        <p className="text-gray-500 text-sm mb-6 max-w-xs">
          The category you are looking for does not exist or may have moved.
        </p>
        <button
          onClick={() => router.push('/services')}
          className="px-5 py-2.5 bg-brand-maroon-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-maroon-600 active:scale-95 transition-all"
        >
          Back to Services
        </button>
      </div>
    );
  }

  const tabItems = subcategories.map((sc) => ({
    name: sc.name,
    slug: sc.slug,
  }));

  return (
    <div className="min-h-screen bg-gray-50 pb-20 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length <= 2) {
                router.push('/services');
              } else {
                router.back();
              }
            }}
            className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="flex-1 text-center font-bold text-gray-900 truncate px-4">
            {category.name}
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Description */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <p className="text-sm text-gray-500">{category.description}</p>
      </div>

      {/* Subcategory Tabs */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <SubcategoryTabs
          subcategories={tabItems}
          activeSlug={activeSubSlug}
          onSelect={setActiveSubSlug}
        />
      </div>

      {/* Service List */}
      {servicesForSubcategory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-maroon-50 mb-4">
            <Sparkles className="w-7 h-7 text-brand-maroon-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">No services here yet</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            This subcategory has no services listed. Try another tab or browse all services.
          </p>
          <Link
            href="/services"
            className="mt-4 text-sm font-semibold text-brand-maroon-500 hover:text-brand-maroon-600 transition-colors"
          >
            Browse all services
          </Link>
        </div>
      ) : slug === 'facials' ||
        slug === 'manicure-pedicure' ||
        slug === 'waxing' ||
        slug === 'clean-ups' ||
        slug === 'bleach' ||
        slug === 'threading' ||
        slug === 'body-polishing-massage' ||
        slug === 'de-tan-pack' ? (
        <div className="mx-4 mt-4 pb-4">
          <ServiceCardGrid services={servicesForSubcategory} categorySlug={slug} />
        </div>
      ) : (
        <div className="bg-white mx-4 mt-4 rounded-2xl px-4 py-2 shadow-sm">
          <ServiceList services={servicesForSubcategory} categorySlug={slug} />
        </div>
      )}

      {/* Sticky Cart Footer — Phase 6: opens the global CartDrawer instead of routing to /cart */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up-sheet">
          <div className="bg-brand-green-600 px-4 py-3.5 shadow-float-btn safe-area-bottom">
            <button
              type="button"
              onClick={openCart}
              className="flex w-full items-center justify-between text-white active:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="font-semibold text-sm">
                  View Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                </span>
              </div>
              <span className="font-bold text-base">
                {cartTotal.toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 0,
                })}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
