'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  Search,
  Calendar,
  CreditCard,
  MessageCircle,
  XCircle,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

interface FaqSection {
  readonly id: string;
  readonly title: string;
  readonly items: ReadonlyArray<FaqItem>;
}

interface QuickAction {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly href?: string;
  readonly scrollTo?: string;
}

// ---------------------------------------------------------------------------
// FAQ Data
// ---------------------------------------------------------------------------

const FAQ_SECTIONS: ReadonlyArray<FaqSection> = [
  {
    id: 'booking',
    title: 'Booking & Services',
    items: [
      {
        id: 'booking-1',
        question: 'How do I book a service?',
        answer:
          "Browse our services, select what you'd like, choose a date and time slot, then proceed to payment. You can book for salon visits or home service.",
      },
      {
        id: 'booking-2',
        question: 'Can I book for home service?',
        answer:
          "Yes! During checkout, select 'Home' as your location and provide your address. Additional charges may apply for home services.",
      },
      {
        id: 'booking-3',
        question: 'How far in advance can I book?',
        answer:
          'You can book up to 30 days in advance. We recommend booking at least 24 hours ahead for the best availability.',
      },
      {
        id: 'booking-4',
        question: 'Can I choose my therapist?',
        answer:
          'Yes, you can select a preferred therapist during the booking process if available for your chosen time slot.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments & Pricing',
    items: [
      {
        id: 'payments-1',
        question: 'What payment methods are accepted?',
        answer:
          'Glamornate is a pay-at-spa platform. You confirm your booking online and pay the spa directly at the time of service — cash, UPI, or card depending on what the spa accepts.',
      },
      {
        id: 'payments-2',
        question: 'Is my payment information secure?',
        answer:
          'We never collect or store payment details for your spa visit — payment happens at the spa directly.',
      },
      {
        id: 'payments-3',
        question: 'How do I apply a voucher code?',
        answer:
          'Enter your voucher code before confirming your booking. The discount will be reflected in the total you pay at the spa.',
      },
      {
        id: 'payments-4',
        question: 'When will I be charged?',
        answer:
          'You are not charged when you book. Pay the spa directly at the time of service.',
      },
    ],
  },
  {
    id: 'cancellation',
    title: 'Cancellation & Refunds',
    items: [
      {
        id: 'cancellation-1',
        question: 'How do I cancel a booking?',
        answer:
          "Go to My Bookings, select the booking you want to cancel, and tap 'Cancel Booking'. Cancellations made 24+ hours before the appointment are fully refunded.",
      },
      {
        id: 'cancellation-2',
        question: 'What is the refund policy?',
        answer:
          'Full refund for cancellations 24+ hours before appointment. 50% refund for cancellations 12-24 hours before. No refund for cancellations less than 12 hours before.',
      },
      {
        id: 'cancellation-3',
        question: 'How long do refunds take?',
        answer:
          'Refunds are processed within 5-7 business days and credited back to your original payment method.',
      },
      {
        id: 'cancellation-4',
        question: 'Can I reschedule instead of cancelling?',
        answer:
          "Yes! Go to My Bookings, select the booking, and tap 'Reschedule'. You can change the date and time without any extra charges.",
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & Privacy',
    items: [
      {
        id: 'account-1',
        question: 'How do I update my profile?',
        answer:
          'Go to your Account page, tap on your profile section. You can update your name, phone number, and profile photo.',
      },
      {
        id: 'account-2',
        question: 'How do I delete my account?',
        answer:
          'Go to Account > Edit Profile > Delete Account. Please note this action is irreversible and all your data will be permanently removed.',
      },
      {
        id: 'account-3',
        question: 'Is my personal data safe?',
        answer:
          'We take your privacy seriously. Your data is encrypted and stored securely. Read our Privacy Policy for full details.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Quick Actions
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: ReadonlyArray<QuickAction> = [
  {
    label: 'Track Booking',
    icon: <Calendar className="w-5 h-5" />,
    href: '/customer/bookings',
  },
  {
    label: 'Payment Issues',
    icon: <CreditCard className="w-5 h-5" />,
    scrollTo: 'payments',
  },
  {
    label: 'Contact Support',
    icon: <MessageCircle className="w-5 h-5" />,
    href: '/contact',
  },
  {
    label: 'Cancel Booking',
    icon: <XCircle className="w-5 h-5" />,
    scrollTo: 'cancellation',
  },
];

// ---------------------------------------------------------------------------
// Accordion Item
// ---------------------------------------------------------------------------

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  readonly item: FaqItem;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
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
            isOpen ? 'rotate-180' : '',
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
  );
}

// ---------------------------------------------------------------------------
// FAQ Section Component
// ---------------------------------------------------------------------------

function FaqSectionCard({
  section,
  openItems,
  onToggle,
}: {
  readonly section: FaqSection;
  readonly openItems: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
}) {
  return (
    <div id={`faq-${section.id}`} className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <h2 className="text-sm font-bold text-gray-900 px-4 pt-4 pb-2">
        {section.title}
      </h2>
      {section.items.map((item) => (
        <AccordionItem
          key={item.id}
          item={item}
          isOpen={openItems.has(item.id)}
          onToggle={() => onToggle(item.id)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Action Card
// ---------------------------------------------------------------------------

function QuickActionCard({
  action,
  onScrollTo,
}: {
  readonly action: QuickAction;
  readonly onScrollTo: (sectionId: string) => void;
}) {
  const content = (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition-all cursor-pointer">
      <div className="w-8 h-8 p-1.5 rounded-xl bg-brand-maroon-50 text-brand-maroon-500 flex items-center justify-center">
        {action.icon}
      </div>
      <span className="text-xs font-medium text-gray-700 text-center">
        {action.label}
      </span>
    </div>
  );

  if (action.href) {
    return <Link href={action.href}>{content}</Link>;
  }

  if (action.scrollTo) {
    return (
      <button
        type="button"
        onClick={() => onScrollTo(action.scrollTo!)}
        className="text-left"
      >
        {content}
      </button>
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const chatStore = useChatStore();
  const contentRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleScrollTo = useCallback((sectionId: string) => {
    const element = document.getElementById(`faq-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const filteredSections = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return FAQ_SECTIONS;

    return FAQ_SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(query) ||
            item.answer.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-section-bg pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-white px-4 pt-14 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle className="w-5 h-5 text-brand-maroon-500" />
          <h1 className="text-xl font-bold text-gray-900">Help Center</h1>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Find answers to common questions
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 pl-10 text-sm placeholder:text-gray-400 focus:outline-none focus:border-brand-maroon-300 focus:ring-1 focus:ring-brand-maroon-300 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="px-4 pt-4 space-y-4">
        {/* Quick Actions */}
        {!searchQuery && (
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard
                key={action.label}
                action={action}
                onScrollTo={handleScrollTo}
              />
            ))}
          </div>
        )}

        {/* FAQ Sections */}
        {filteredSections.length > 0 ? (
          filteredSections.map((section) => (
            <FaqSectionCard
              key={section.id}
              section={section}
              openItems={openItems}
              onToggle={handleToggle}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-maroon-50 mb-4">
              <Search className="w-6 h-6 text-brand-maroon-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              No results found
            </h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Try a different search term or browse our FAQ categories below.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-4 text-sm font-medium text-brand-maroon-500 active:opacity-70 transition-opacity"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Still Need Help */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Still Need Help?
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Couldn&apos;t find what you&apos;re looking for?
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/contact"
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-brand-maroon-500 to-brand-gold-500 text-white rounded-xl py-3 text-sm font-semibold active:opacity-90 transition-opacity"
            >
              Contact Support
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => chatStore.openChat()}
              className="flex items-center justify-center gap-2 w-full border border-brand-maroon-200 text-brand-maroon-600 rounded-xl py-3 text-sm font-semibold active:bg-brand-maroon-50 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Live Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
