'use client';

interface SubcategoryTabsProps {
  subcategories: { name: string; slug: string }[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}

export default function SubcategoryTabs({
  subcategories,
  activeSlug,
  onSelect,
}: SubcategoryTabsProps) {
  if (subcategories.length <= 1) {
    return null;
  }

  return (
    <div role="tablist" className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
      {subcategories.map((sub) => {
        const isActive = sub.slug === activeSlug;

        return (
          <button
            key={sub.slug}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(sub.slug)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-maroon-500 text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {sub.name}
          </button>
        );
      })}
    </div>
  );
}
