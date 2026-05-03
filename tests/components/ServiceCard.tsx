export interface ServiceCardProps {
  service: {
    id: string
    name: string
    description: string
    category: string
    baseDuration: number
    basePrice: number
    currency?: string
    tags?: string[]
  }
  selected?: boolean
  onSelect?: (serviceId: string) => void
}

export { ServiceCard } from './ServiceCard'
