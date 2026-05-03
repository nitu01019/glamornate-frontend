'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface CategoryCardProps {
  name: string
  slug: string
  serviceCount: number
  priceRange: { min: number; max: number }
  ordering: number
}

const gradients = [
  'from-rose-100 to-pink-50',
  'from-violet-100 to-purple-50',
  'from-sky-100 to-blue-50',
  'from-emerald-100 to-green-50',
  'from-amber-100 to-yellow-50',
  'from-fuchsia-100 to-pink-50',
  'from-teal-100 to-cyan-50',
  'from-orange-100 to-red-50',
  'from-indigo-100 to-violet-50',
  'from-lime-100 to-emerald-50',
  'from-pink-100 to-rose-50',
  'from-cyan-100 to-sky-50',
  'from-yellow-100 to-amber-50',
]

export default function CategoryCard({
  name,
  slug,
  serviceCount,
  priceRange,
  ordering,
}: CategoryCardProps) {
  const gradientIndex = (ordering - 1) % gradients.length
  const gradient = gradients[gradientIndex]

  return (
    <Link href={`/services/category/${slug}`} className="block group">
      <div
        className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 h-full flex flex-col justify-between shadow-card-sm group-hover:shadow-card-md group-active:scale-[0.97] transition-all duration-200`}
      >
        <div>
          <h3 className="font-bold text-gray-900 text-base leading-tight mb-1">
            {name}
          </h3>
          <p className="text-xs text-gray-500">{serviceCount} services</p>
        </div>

        <div className="flex items-end justify-between mt-3">
          <p className="text-xs font-medium text-gray-600">
            {priceRange.min.toLocaleString('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            })}{' '}
            -{' '}
            {priceRange.max.toLocaleString('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            })}
          </p>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </div>
      </div>
    </Link>
  )
}
