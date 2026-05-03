'use client';

import { useState, useCallback } from 'react';
import {
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  CheckCircle,
  Send,
  AlertCircle,
} from 'lucide-react';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().min(1, 'Please select a subject'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be less than 2000 characters'),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBJECT_OPTIONS = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'booking', label: 'Booking Issue' },
  { value: 'payment', label: 'Payment Problem' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Other' },
] as const;

const CONTACT_METHODS = [
  {
    icon: Phone,
    title: 'Call Us',
    detail: '+91 98765 43210',
    subtitle: 'Mon-Sat, 9am-8pm IST',
    href: 'tel:+919876543210',
  },
  {
    icon: Mail,
    title: 'Email Us',
    detail: 'support@glamornate.com',
    subtitle: 'We reply within 24 hours',
    href: 'mailto:support@glamornate.com',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    detail: 'Chat on WhatsApp',
    subtitle: 'Quick responses',
    href: 'https://wa.me/919876543210',
  },
] as const;

// ---------------------------------------------------------------------------
// Contact Method Row
// ---------------------------------------------------------------------------

function ContactMethodRow({
  icon: Icon,
  title,
  detail,
  subtitle,
  href,
  isLast,
}: {
  readonly icon: typeof Phone;
  readonly title: string;
  readonly detail: string;
  readonly subtitle: string;
  readonly href: string;
  readonly isLast: boolean;
}) {
  return (
    <a
      href={href}
      target={href.startsWith('https') ? '_blank' : undefined}
      rel={href.startsWith('https') ? 'noopener noreferrer' : undefined}
      className={cn(
        'flex items-center gap-4 px-4 py-4 active:bg-gray-50 transition-colors',
        !isLast && 'border-b border-gray-100',
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-brand-maroon-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-brand-maroon-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="text-sm font-medium text-gray-900">{detail}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Success State
// ---------------------------------------------------------------------------

function SubmitSuccess({ onReset }: { readonly onReset: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-6">
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4 animate-fade-in">
          <CheckCircle className="w-7 h-7 text-green-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Message Sent!</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          We&apos;ll get back to you within 24 hours.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-5 text-sm font-medium text-brand-maroon-500 active:opacity-70 transition-opacity"
        >
          Send another message
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact Form
// ---------------------------------------------------------------------------

function ContactForm({ onSuccess }: { readonly onSuccess: () => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = useCallback(
    async (data: ContactFormData) => {
      setSubmitError(null);
      try {
        // Attempt Firestore write
        const { collections, firestoreService } = await import('@/lib/firebase-client');
        const ticketData = {
          type: data.subject,
          priority: 'medium' as const,
          status: 'open' as const,
          subject: `[Contact Form] ${
            SUBJECT_OPTIONS.find((o) => o.value === data.subject)?.label ?? data.subject
          }`,
          description: data.message,
          attachments: [],
          messages: [
            {
              sender: 'customer',
              message: data.message,
              attachments: [],
              timestamp: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
        };
        // SEC: only flip to success state AFTER the write resolves. Previously
        // the catch branch also called onSuccess(), which silently lied to the
        // user when Firestore was unreachable / rules denied the write.
        await firestoreService.addDoc(
          collections.supportTickets() as Parameters<typeof firestoreService.addDoc>[0],
          ticketData as Parameters<typeof firestoreService.addDoc>[1],
        );

        onSuccess();
        reset();
      } catch {
        // Surface the real failure + offer the mailto fallback so the user
        // is never left thinking their message was delivered when it wasn't.
        setSubmitError(
          "We couldn't send your message right now. Please email support@glamornate.com directly or try again in a moment.",
        );
      }
    },
    [onSuccess, reset],
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-bold text-gray-900">Send us a message</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="px-4 pb-5 space-y-4" noValidate>
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5"
          >
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-700 leading-relaxed">{submitError}</p>
              <a
                href="mailto:support@glamornate.com"
                className="text-xs font-medium text-red-700 underline mt-1 inline-block"
              >
                Email support@glamornate.com
              </a>
            </div>
          </div>
        )}
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-name" className="text-gray-700">
            Name
          </Label>
          <Input
            id="contact-name"
            type="text"
            placeholder="Your full name"
            {...register('name')}
            className={cn(
              errors.name &&
                'border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400',
            )}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="text-gray-700">
            Email
          </Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="your@email.com"
            {...register('email')}
            className={cn(
              errors.email &&
                'border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400',
            )}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        {/* Subject — Radix Select needs `Controller` because it's not a native input */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-subject" className="text-gray-700">
            Subject
          </Label>
          <Controller
            name="subject"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="contact-subject"
                  className={cn(
                    'w-full rounded-xl',
                    errors.subject && 'border-red-400 focus:ring-red-400',
                  )}
                >
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.subject && <p className="text-xs text-red-500">{errors.subject.message}</p>}
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-message" className="text-gray-700">
            Message
          </Label>
          <textarea
            id="contact-message"
            rows={4}
            placeholder="How can we help you?"
            {...register('message')}
            className={cn(
              'flex w-full rounded-lg border border-brand-maroon-200 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-brand-maroon-400 focus-visible:outline-none focus-visible:border-brand-gold-500 focus-visible:ring-2 focus-visible:ring-brand-gold-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
              errors.message &&
                'border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400',
            )}
          />
          {errors.message && <p className="text-xs text-red-500">{errors.message.message}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white rounded-xl py-3 w-full font-semibold text-sm active:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            'Sending...'
          ) : (
            <>
              Send Message
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContactPage() {
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSuccess = useCallback(() => {
    setIsSuccess(true);
  }, []);

  const handleReset = useCallback(() => {
    setIsSuccess(false);
  }, []);

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-white px-4 pt-14 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-5 h-5 text-brand-maroon-500" />
          <h1 className="text-xl font-bold text-gray-900">Contact Us</h1>
        </div>
        <p className="text-sm text-gray-500">We&apos;d love to hear from you</p>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-4">
        {/* Contact Methods */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {CONTACT_METHODS.map((method, index) => (
            <ContactMethodRow
              key={method.title}
              icon={method.icon}
              title={method.title}
              detail={method.detail}
              subtitle={method.subtitle}
              href={method.href}
              isLast={index === CONTACT_METHODS.length - 1}
            />
          ))}
        </div>

        {/* Contact Form or Success */}
        {isSuccess ? (
          <SubmitSuccess onReset={handleReset} />
        ) : (
          <ContactForm onSuccess={handleSuccess} />
        )}

        {/* Office Address */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-brand-maroon-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-brand-maroon-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Our Office</h2>
          </div>
          <div className="text-sm text-gray-600 leading-relaxed space-y-0.5 pl-10">
            <p className="font-medium text-gray-800">Glamornate Technologies Pvt. Ltd.</p>
            <p>123 Wellness Street, Koramangala</p>
            <p>Bengaluru, Karnataka 560034</p>
            <p>India</p>
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-brand-maroon-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-brand-maroon-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Business Hours</h2>
          </div>
          <div className="text-sm text-gray-600 leading-relaxed space-y-1 pl-10">
            <p>Monday - Saturday: 9:00 AM - 8:00 PM IST</p>
            <p>Sunday: 10:00 AM - 6:00 PM IST</p>
            <p className="text-gray-400">Holidays: Limited hours</p>
          </div>
        </div>
      </div>
    </div>
  );
}
