'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Crown,
  Percent,
  XCircle,
  Star,
  Gift,
  Headphones,
  Check,
} from 'lucide-react';
import { useToastActions } from '@/lib/providers';

type PlanType = 'monthly' | 'yearly';

interface Benefit {
  readonly icon: React.ElementType;
  readonly title: string;
  readonly description: string;
}

const BENEFITS: readonly Benefit[] = [
  {
    icon: Crown,
    title: 'Priority Booking',
    description: 'Get preferred time slots before everyone else',
  },
  {
    icon: Percent,
    title: 'Exclusive Discounts',
    description: 'Up to 30% off on all services',
  },
  {
    icon: XCircle,
    title: 'Free Cancellation',
    description: 'Cancel any booking up to 2 hours before',
  },
  {
    icon: Star,
    title: 'VIP Lounge Access',
    description: 'Complimentary access at partner spas',
  },
  {
    icon: Gift,
    title: 'Birthday Special',
    description: 'Free premium service on your birthday',
  },
  {
    icon: Headphones,
    title: 'Dedicated Support',
    description: 'Priority customer support line',
  },
] as const;

interface PlanConfig {
  readonly id: PlanType;
  readonly name: string;
  readonly price: string;
  readonly perMonth: string;
  readonly badge: string;
  readonly badgeColor: string;
  readonly cta: string;
}

const PLANS: readonly PlanConfig[] = [
  {
    id: 'monthly',
    name: 'Monthly Plan',
    price: '294',
    perMonth: '294/month',
    badge: 'Most Popular',
    badgeColor: 'bg-brand-maroon-500 text-white',
    cta: 'Subscribe Monthly',
  },
  {
    id: 'yearly',
    name: 'Yearly Plan',
    price: '2,940',
    perMonth: '245/month',
    badge: 'Best Value -- Save 17%',
    badgeColor: 'bg-brand-gold-500 text-brand-maroon-950',
    cta: 'Subscribe Yearly',
  },
] as const;

export default function EliteSubscriptionPage() {
  const router = useRouter();
  const toast = useToastActions();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');

  const handleSubscribe = (plan: PlanType) => {
    toast.info(
      'Coming Soon',
      `Payment integration for the ${plan} plan is coming soon.`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-6 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-brand-maroon-500 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <h1 className="text-2xl font-bold font-serif text-gray-900">
          Glamornate Elite
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Unlock premium spa experiences
        </p>
      </div>

      {/* Hero Card */}
      <div className="px-4 mt-6">
        <div className="rounded-2xl bg-gradient-to-br from-brand-maroon-950 to-brand-maroon-800 p-6 shadow-maroon-lg">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-6 h-6 text-brand-gold-500" />
            <span className="text-brand-gold-500 font-bold italic text-xl tracking-wide">
              Elite
            </span>
          </div>
          <p className="text-white/90 text-sm leading-relaxed">
            Join our exclusive membership and enjoy premium benefits across all
            partner spas.
          </p>
          <div className="mt-4 bg-white/10 rounded-xl px-4 py-3">
            <p className="text-brand-gold-400 font-semibold text-lg">
              Save up to 30% on every booking
            </p>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="px-4 mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Elite Benefits
        </h2>
        <div className="space-y-3">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="flex items-start gap-4 bg-brand-maroon-50 rounded-xl p-4"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Icon className="w-5 h-5 text-brand-maroon-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {benefit.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing Tiers */}
      <div className="px-4 mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative bg-white rounded-2xl p-4 text-left transition-all ${
                  isSelected
                    ? 'border-2 border-brand-gold-500 shadow-gold'
                    : 'border border-gray-200 shadow-sm'
                }`}
              >
                {/* Badge */}
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-3 ${plan.badgeColor}`}
                >
                  {plan.badge}
                </span>

                {/* Plan Name */}
                <p className="text-sm font-semibold text-gray-900">
                  {plan.name}
                </p>

                {/* Price */}
                <div className="mt-2">
                  <span className="text-xs text-gray-500">Rs </span>
                  <span className="text-2xl font-bold text-brand-maroon-500">
                    {plan.price}
                  </span>
                  <span className="text-xs text-gray-500">
                    /{plan.id === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>

                {/* Per-month breakdown for yearly */}
                {plan.id === 'yearly' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Rs {plan.perMonth}
                  </p>
                )}

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-brand-gold-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-brand-maroon-950" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA Button */}
      <div className="px-4 mt-8">
        <button
          onClick={() => handleSubscribe(selectedPlan)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-gold-500 to-brand-gold-600 text-brand-maroon-950 font-bold text-base shadow-gold transition-opacity active:opacity-90"
        >
          {selectedPlan === 'monthly' ? 'Subscribe Monthly' : 'Subscribe Yearly'}
        </button>
      </div>

      {/* Bottom section */}
      <div className="px-4 mt-6 text-center">
        <p className="text-xs text-gray-400">Terms & Conditions apply</p>
        <p className="text-xs text-gray-500 mt-2">
          Already a member?{' '}
          <button
            onClick={() =>
              toast.info(
                'Manage Subscription',
                'Subscription management will be available soon.'
              )
            }
            className="text-brand-maroon-500 font-medium underline"
          >
            Manage subscription
          </button>
        </p>
      </div>
    </div>
  );
}
