/** Shared types for home page components */

import type { ServiceBadge } from '@/lib/badge-engine';

export interface ServiceItem {
  id: string;
  name: string;
  duration: string;
  price: number;
  originalPrice: number;
  discount: number;
  image: string;
  category: string;
  badges: ServiceBadge[];
}

export interface CategoryItem {
  id: string;
  name: string;
  image: string;
  count: number;
  isNew: boolean;
}

export interface PromotionItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  cta: string;
  link: string;
}
