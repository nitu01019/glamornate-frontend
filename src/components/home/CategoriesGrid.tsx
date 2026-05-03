'use client';

import { useRouter } from 'next/navigation';
import { Scissors, Sparkles, Droplet, Heart, Hand, Footprints, Plus, type LucideIcon } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  bg: string;
  color: string;
}

const categories: Category[] = [
  {
    id: 'massage',
    name: 'Massage',
    icon: Scissors,
    bg: 'bg-brand-maroon-50',
    color: 'text-brand-maroon-600',
  },
  {
    id: 'facial',
    name: 'Facial',
    icon: Sparkles,
    bg: 'bg-brand-gold-50',
    color: 'text-brand-gold-600',
  },
  {
    id: 'body',
    name: 'Body',
    icon: Droplet,
    bg: 'bg-teal-50',
    color: 'text-teal-600',
  },
  {
    id: 'wellness',
    name: 'Wellness',
    icon: Heart,
    bg: 'bg-purple-50',
    color: 'text-purple-600',
  },
  {
    id: 'manicure',
    name: 'Manicure',
    icon: Hand,
    bg: 'bg-pink-50',
    color: 'text-pink-600',
  },
  {
    id: 'pedicure',
    name: 'Pedicure',
    icon: Footprints,
    bg: 'bg-green-50',
    color: 'text-green-600',
  },
  {
    id: 'more',
    name: 'More',
    icon: Plus,
    bg: 'bg-gray-50',
    color: 'text-gray-600',
  },
];

export default function CategoriesGrid() {
  const router = useRouter();

  const handleCategoryClick = (categoryId: string) => {
    if (categoryId === 'more') {
      router.push('/services');
    } else {
      router.push(`/spas?category=${categoryId}`);
    }
  };

  return (
    <section className="bg-white px-4 pt-2 pb-6">
      <div className="grid grid-cols-4 gap-4">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            className="flex flex-col items-center gap-2 py-2 touch-target active:scale-95 transition-transform"
          >
            <div
              className={`w-14 h-14 rounded-2xl ${category.bg} flex items-center justify-center shadow-sm`}
            >
              <category.icon className={`w-7 h-7 ${category.color}`} />
            </div>
            <span className={`text-xs font-medium ${category.color}`}>
              {category.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
