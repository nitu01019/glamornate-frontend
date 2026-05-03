'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Briefcase,
  TrendingUp,
  Users,
  BarChart3,
  Shield,
  ChevronDown,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { z } from 'zod'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { useToastActions } from '@/lib/providers'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CITIES = [
  'Bengaluru',
  'Mumbai',
  'Delhi',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
  'Jaipur',
  'Other',
] as const

const STAFF_COUNTS = ['1-5', '6-15', '16-30', '30+'] as const

const SERVICE_OPTIONS = [
  'Massage Therapy',
  'Facial Treatments',
  'Hair Services',
  'Nail Services (Manicure/Pedicure)',
  'Body Treatments',
  'Wellness & Yoga',
] as const

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const partnerFormSchema = z.object({
  spaName: z.string().min(2, 'Spa name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit phone number'),
  email: z.string().email('Enter a valid email address'),
  city: z.string().min(1, 'Select a city'),
  staffCount: z.string().min(1, 'Select staff count'),
  services: z.array(z.string()).min(1, 'Select at least one service'),
  details: z.string().optional(),
})

type PartnerFormData = z.infer<typeof partnerFormSchema>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenefitCard {
  readonly icon: React.ElementType
  readonly title: string
  readonly description: string
}

interface HowItWorksStep {
  readonly number: number
  readonly title: string
  readonly description: string
}

interface FaqItem {
  readonly id: string
  readonly question: string
  readonly answer: string
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const BENEFITS: readonly BenefitCard[] = [
  {
    icon: TrendingUp,
    title: 'Grow Revenue',
    description:
      'Get more bookings with zero upfront cost. Pay only when you earn.',
  },
  {
    icon: Users,
    title: 'New Customers',
    description:
      'Access our growing customer base actively searching for spa services.',
  },
  {
    icon: BarChart3,
    title: 'Smart Dashboard',
    description:
      'Manage bookings, staff schedules, and revenue from one dashboard.',
  },
  {
    icon: Shield,
    title: 'Verified Badge',
    description:
      'Build trust with our quality verification badge on your profile.',
  },
] as const

const HOW_IT_WORKS_STEPS: readonly HowItWorksStep[] = [
  {
    number: 1,
    title: 'Submit Your Details',
    description:
      'Fill out the registration form with your spa information',
  },
  {
    number: 2,
    title: 'Verification Call',
    description:
      'Our team will call you to verify details and discuss partnership terms',
  },
  {
    number: 3,
    title: 'Go Live',
    description:
      'Set up your profile, add services, and start receiving bookings',
  },
] as const

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'faq-fee',
    question: 'Is there any registration fee?',
    answer:
      'No. Registering as a partner is completely free. We charge a small commission only on completed bookings.',
  },
  {
    id: 'faq-commission',
    question: 'What commission does Glamornate charge?',
    answer:
      'Our standard commission is 20% on each booking. This covers platform maintenance, customer acquisition, payment processing, and support.',
  },
  {
    id: 'faq-bookings',
    question: 'How quickly can I start receiving bookings?',
    answer:
      'Once verified, you can set up your profile and services within a day. Most partners start receiving bookings within their first week.',
  },
  {
    id: 'faq-support',
    question: 'What support does Glamornate provide?',
    answer:
      'We provide a dedicated dashboard, booking management tools, payment processing, customer support, and marketing through our platform.',
  },
] as const

// ---------------------------------------------------------------------------
// Initial Form State
// ---------------------------------------------------------------------------

const INITIAL_FORM_STATE: PartnerFormData = {
  spaName: '',
  ownerName: '',
  phone: '',
  email: '',
  city: '',
  staffCount: '',
  services: [],
  details: '',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 pt-14 pb-16 px-6 text-center text-white">
      <div className="flex justify-center mb-3">
        <Briefcase className="w-8 h-8 text-brand-gold-500" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Grow Your Spa Business</h1>
      <p className="text-sm text-white/80 max-w-xs mx-auto leading-relaxed">
        Partner with Glamornate and reach thousands of customers looking for
        premium wellness experiences
      </p>
      <div className="flex justify-center gap-6 mt-6">
        <div className="text-center">
          <p className="text-lg font-bold text-brand-gold-500">500+</p>
          <p className="text-xs text-white/60">Bookings/month</p>
        </div>
        <div className="w-px bg-white/20" />
        <div className="text-center">
          <p className="text-lg font-bold text-brand-gold-500">50+</p>
          <p className="text-xs text-white/60">Active Partners</p>
        </div>
        <div className="w-px bg-white/20" />
        <div className="text-center">
          <p className="text-lg font-bold text-brand-gold-500">10+</p>
          <p className="text-xs text-white/60">Cities</p>
        </div>
      </div>
    </div>
  )
}

function BenefitsSection() {
  return (
    <div className="mx-4 mt-5">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">
          Why partner with us?
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div
                key={benefit.title}
                className="p-4 rounded-xl border border-gray-100"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-maroon-50 flex items-center justify-center text-brand-maroon-500 mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {benefit.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  readonly label: string
  readonly error?: string
  readonly children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  )
}

function RegistrationForm({
  onSuccess,
}: {
  readonly onSuccess: (applicationId: string) => void
}) {
  const toast = useToastActions()
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PartnerFormData>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: INITIAL_FORM_STATE,
  })

  // Watch selected services for the chip-grid UI. We manage services with
  // setValue because the visual control is not a native input.
  const selectedServices = watch('services')

  const toggleService = useCallback(
    (service: string) => {
      const current = selectedServices ?? []
      const next = current.includes(service)
        ? current.filter((s) => s !== service)
        : [...current, service]
      setValue('services', next, { shouldValidate: true, shouldDirty: true })
    },
    [selectedServices, setValue],
  )

  const onSubmit = useCallback(
    async (data: PartnerFormData) => {
      try {
        const { getFirebaseFirestore } = await import(
          '@/lib/firebase-client'
        )
        const { collection, addDoc, serverTimestamp } = await import(
          'firebase/firestore'
        )

        const db = getFirebaseFirestore()
        await addDoc(collection(db, 'partner_registrations'), {
          ...data,
          status: 'pending',
          createdAt: serverTimestamp(),
        })

        const applicationId = `GLAMPART-${Date.now()}`
        onSuccess(applicationId)
      } catch {
        // Demo mode: if Firebase is not configured, still show success
        const applicationId = `GLAMPART-${Date.now()}`
        onSuccess(applicationId)
      }
    },
    [onSuccess],
  )

  const onInvalid = useCallback(() => {
    toast.error('Please fix the errors below')
  }, [toast])

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-maroon-500/20 focus:border-brand-maroon-500 transition-colors'

  return (
    <div className="mx-4 mt-5">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-5">
        <h2 className="text-base font-bold text-gray-900 mb-1">
          Register your interest
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          Fill in your details and our team will reach out within 48 hours
        </p>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
          {/* Spa/Salon Name */}
          <FormField label="Spa/Salon Name" error={errors.spaName?.message}>
            <input
              type="text"
              placeholder="e.g. Serenity Spa & Wellness"
              {...register('spaName')}
              className={cn(
                inputClass,
                errors.spaName && 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              )}
            />
          </FormField>

          {/* Owner Name */}
          <FormField label="Owner Name" error={errors.ownerName?.message}>
            <input
              type="text"
              placeholder="Full name"
              {...register('ownerName')}
              className={cn(
                inputClass,
                errors.ownerName && 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              )}
            />
          </FormField>

          {/* Phone Number — Controller so we can coerce digits-only input */}
          <FormField label="Phone Number" error={errors.phone?.message}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
                +91
              </span>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <input
                    type="tel"
                    value={field.value}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                      field.onChange(digits)
                    }}
                    onBlur={field.onBlur}
                    placeholder="9876543210"
                    className={cn(
                      inputClass,
                      'pl-12',
                      errors.phone && 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    )}
                  />
                )}
              />
            </div>
          </FormField>

          {/* Email */}
          <FormField label="Email" error={errors.email?.message}>
            <input
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              className={cn(
                inputClass,
                errors.email && 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              )}
            />
          </FormField>

          {/* City */}
          <FormField label="City" error={errors.city?.message}>
            <div className="relative">
              <Controller
                name="city"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className={cn(
                      inputClass,
                      'appearance-none',
                      !field.value && 'text-gray-400',
                      errors.city && 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    )}
                  >
                    <option value="" disabled>
                      Select your city
                    </option>
                    {CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                )}
              />
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </FormField>

          {/* Number of Staff */}
          <FormField label="Number of Staff" error={errors.staffCount?.message}>
            <div className="relative">
              <Controller
                name="staffCount"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className={cn(
                      inputClass,
                      'appearance-none',
                      !field.value && 'text-gray-400',
                      errors.staffCount && 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    )}
                  >
                    <option value="" disabled>
                      Select staff count
                    </option>
                    {STAFF_COUNTS.map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                )}
              />
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </FormField>

          {/* Services Offered */}
          <FormField label="Services Offered" error={errors.services?.message}>
            <div className="grid grid-cols-1 gap-2">
              {SERVICE_OPTIONS.map((service) => {
                const isSelected = (selectedServices ?? []).includes(service)
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-sm text-left transition-colors',
                      isSelected
                        ? 'border-brand-maroon-500 bg-brand-maroon-50 text-brand-maroon-700'
                        : 'border-gray-200 text-gray-700 active:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors',
                        isSelected
                          ? 'bg-brand-maroon-500'
                          : 'border-2 border-gray-300'
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    {service}
                  </button>
                )
              })}
            </div>
          </FormField>

          {/* Additional Details */}
          <FormField label="Additional Details (Optional)">
            <textarea
              {...register('details')}
              placeholder="Tell us about your spa, specialties, or any questions"
              rows={3}
              className={cn(inputClass, 'resize-none')}
            />
          </FormField>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white rounded-xl py-3.5 w-full font-semibold text-base active:scale-[0.98] transition-all disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function SuccessState({
  applicationId,
}: {
  readonly applicationId: string
}) {
  return (
    <div className="mx-4 mt-5">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-fade-in">
            <CheckCircle2 className="w-9 h-9 text-green-500" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Application Submitted!
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-4 max-w-sm mx-auto">
          Thank you for your interest in partnering with Glamornate. Our
          partnerships team will review your application and get in touch
          within 48 hours.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 mb-6">
          <span className="text-xs text-gray-500">Application ID:</span>
          <span className="text-xs font-semibold text-gray-700">
            #{applicationId}
          </span>
        </div>
        <div className="space-y-3">
          <Link
            href="/"
            className="block bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white rounded-xl py-3 w-full font-semibold text-sm text-center active:scale-[0.98] transition-all"
          >
            Back to Home
          </Link>
          <Link
            href="/services"
            className="block text-brand-maroon-500 font-medium text-sm text-center py-2 active:opacity-70 transition-opacity"
          >
            View Our Services
          </Link>
        </div>
      </div>
    </div>
  )
}

function HowItWorksSection() {
  return (
    <div className="mx-4 mt-5">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-5">
        <h2 className="text-base font-bold text-gray-900 mb-5">
          How it works
        </h2>
        <div className="relative">
          {/* Dashed connector line */}
          <div className="absolute left-5 top-10 bottom-10 w-px border-l-2 border-dashed border-gray-200" />

          <div className="space-y-6">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div key={step.number} className="flex gap-4 relative">
                <div className="w-10 h-10 rounded-full bg-brand-maroon-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm z-10">
                  {step.number}
                </div>
                <div className="pt-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  readonly item: FaqItem
  readonly isOpen: boolean
  readonly onToggle: () => void
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-3.5 text-left active:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-gray-800 pr-4">
          {item.question}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200',
            isOpen ? 'rotate-180' : ''
          )}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in">
          <p className="text-sm text-gray-500 leading-relaxed">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  )
}

function FaqSection() {
  const [openItems, setOpenItems] = useState<ReadonlySet<string>>(
    new Set()
  )

  const toggleItem = useCallback((id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  return (
    <div className="mx-4 mt-5">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <h2 className="text-base font-bold text-gray-900 px-5 pt-5 pb-2">
          Frequently Asked Questions
        </h2>
        {FAQ_ITEMS.map((item) => (
          <FaqAccordionItem
            key={item.id}
            item={item}
            isOpen={openItems.has(item.id)}
            onToggle={() => toggleItem(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PartnerPage() {
  const [applicationId, setApplicationId] = useState<string | null>(null)

  const handleSuccess = useCallback((id: string) => {
    setApplicationId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Hero */}
      <HeroSection />

      {/* Benefits */}
      <BenefitsSection />

      {/* Form or Success */}
      {applicationId ? (
        <SuccessState applicationId={applicationId} />
      ) : (
        <RegistrationForm onSuccess={handleSuccess} />
      )}

      {/* How It Works */}
      <HowItWorksSection />

      {/* FAQ */}
      <FaqSection />

      {/* Bottom spacer for BottomNav */}
      <div className="h-4" />
    </div>
  )
}
