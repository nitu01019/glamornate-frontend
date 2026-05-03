import type { Metadata } from 'next';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms you agree to when you create a Glamornate account or book a spa service.',
  robots: { index: true, follow: true },
};

// ---------------------------------------------------------------------------
// Static Data
// ---------------------------------------------------------------------------

const LAST_UPDATED = '2026-04-20';
// TODO: confirm the final support email before public launch.
const SUPPORT_EMAIL = 'support@glamornate.example';
const COMPANY_NAME = 'Glamornate Technologies Pvt. Ltd.';

interface SectionProps {
  readonly id: string;
  readonly heading: string;
  readonly children: React.ReactNode;
}

function Section({ id, heading, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="mt-8 scroll-mt-24"
    >
      <h2
        id={`${id}-heading`}
        className="text-lg font-semibold text-gray-900 mb-3"
      >
        {heading}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TermsOfServicePage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-white pb-24 animate-fade-in"
    >
      <header className="border-b border-gray-100 bg-white px-5 pt-14 pb-6">
        <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-1 text-xs text-gray-500">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          These Terms govern your use of the Glamornate app and website, operated
          by {COMPANY_NAME} (&ldquo;Glamornate&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;). Please read them before you create an account or
          book a service.
        </p>
      </header>

      <article className="px-5 pt-2">
        {/* 1. Acceptance */}
        <Section id="acceptance" heading="1. Acceptance of Terms">
          <p>
            By creating a Glamornate account, booking a service, or otherwise
            using the Services, you agree to these Terms and our{' '}
            <Link
              href="/privacy"
              className="text-brand-maroon-600 underline"
            >
              Privacy Policy
            </Link>
            . If you do not agree, please stop using the Services.
          </p>
        </Section>

        {/* 2. Eligibility */}
        <Section id="eligibility" heading="2. Eligibility">
          <ul className="list-disc pl-5 space-y-2">
            <li>You must be at least 18 years old.</li>
            <li>
              You must have legal capacity to enter into a binding agreement
              under Indian law.
            </li>
            <li>
              The Services are intended for personal, non-commercial use by end
              customers. Spa operators and staff use a separate partner portal.
            </li>
          </ul>
        </Section>

        {/* 3. Account */}
        <Section id="account" heading="3. Your account">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              You must provide accurate and up-to-date information when you
              register.
            </li>
            <li>
              Keep your password secret. You are responsible for actions taken
              under your account.
            </li>
            <li>
              One account per person. Sharing an account is not permitted.
            </li>
            <li>
              We may suspend or close accounts that breach these Terms,
              including fraudulent, abusive, or illegal activity.
            </li>
          </ul>
        </Section>

        {/* 4. Service description */}
        <Section
          id="service-description"
          heading="4. What Glamornate actually does"
        >
          <p>
            Glamornate is a marketplace that connects customers with independent
            spa and wellness providers. We are not the spa. We do not employ the
            therapists who perform your service. We facilitate booking,
            scheduling, payment, and after-service support.
          </p>
          <p>
            Service descriptions, photos, and prices are provided by the partner
            spa. We make a reasonable effort to keep them accurate but do not
            guarantee a specific experience.
          </p>
        </Section>

        {/* 5. Payments and pricing */}
        <Section id="payments" heading="5. Payments and pricing">
          <ul className="list-disc pl-5 space-y-2">
            <li>All prices are in Indian Rupees (INR) and include GST unless
              stated otherwise.</li>
            <li>
              Payment is collected by the spa at the time of service.
              Glamornate does not process payments.
            </li>
            <li>
              Prices visible in the app are binding for the specific booking you
              made, even if the listed price changes afterwards.
            </li>
            <li>
              Optional add-ons (e.g., additional minutes, gratuity) are
              displayed before you confirm.
            </li>
          </ul>
        </Section>

        {/* 6. Cancellation and refunds */}
        <Section
          id="cancellation"
          heading="6. Cancellation and refunds"
        >
          <p>Our cancellation policy is:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>More than 24 hours before your slot:</strong> 100% refund
              to the original payment method.
            </li>
            <li>
              <strong>12 to 24 hours before:</strong> 50% refund.
            </li>
            <li>
              <strong>Less than 12 hours before, or no-show:</strong> no
              refund.
            </li>
            <li>
              Refunds reach your account within 5 to 7 business days of
              approval.
            </li>
            <li>
              If the spa cancels, you receive a full refund regardless of
              timing.
            </li>
          </ul>
        </Section>

        {/* 7. User conduct */}
        <Section id="conduct" heading="7. User conduct">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Treat spa staff, therapists, and other users with respect. We have
              zero tolerance for harassment, discrimination, or inappropriate
              behaviour.
            </li>
            <li>
              Do not post reviews containing hate speech, personal attacks, or
              false claims.
            </li>
            <li>
              Do not misuse referral codes, vouchers, or wallet credits. We
              reserve the right to reverse fraudulent transactions.
            </li>
            <li>
              Do not attempt to reverse-engineer, probe, or attack the Services.
            </li>
          </ul>
        </Section>

        {/* 8. Intellectual property */}
        <Section id="intellectual-property" heading="8. Intellectual property">
          <p>
            Glamornate&apos;s logos, brand, app code, and editorial content are
            the property of {COMPANY_NAME}. Content you submit (reviews, photos)
            remains yours; by posting it, you grant Glamornate a worldwide,
            royalty-free licence to display it on the Services.
          </p>
        </Section>

        {/* 9. Liability */}
        <Section id="liability" heading="9. Limitation of liability">
          <p>
            To the maximum extent permitted by Indian law:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Glamornate is a marketplace; we are not liable for the conduct of
              a spa, therapist, or other user.
            </li>
            <li>
              We are not liable for indirect or consequential damages such as
              lost profit or loss of data.
            </li>
            <li>
              Our total aggregate liability for any claim is limited to the
              amount you paid for the specific booking that gave rise to the
              claim.
            </li>
            <li>
              Nothing in these Terms excludes liability that cannot be excluded
              under law (for example, liability for gross negligence or fraud).
            </li>
          </ul>
        </Section>

        {/* 10. Termination */}
        <Section id="termination" heading="10. Termination">
          <p>
            You may close your account at any time from the{' '}
            <Link
              href="/data-deletion"
              className="text-brand-maroon-600 underline"
            >
              Data Deletion page
            </Link>
            . We may suspend or terminate access if you breach these Terms, with
            or without notice. Provisions that by their nature survive
            termination (liability, indemnity, governing law) remain in effect.
          </p>
        </Section>

        {/* 11. Jurisdiction */}
        <Section id="jurisdiction" heading="11. Governing law and disputes">
          <ul className="list-disc pl-5 space-y-2">
            <li>These Terms are governed by the laws of India.</li>
            <li>
              Disputes will first be raised with {SUPPORT_EMAIL}. If unresolved
              within 30 days, they will be referred to arbitration under the
              Arbitration and Conciliation Act, 1996, seated in Bengaluru, in
              English, before a sole arbitrator.
            </li>
            <li>
              Subject to the arbitration clause above, courts in Bengaluru,
              Karnataka have exclusive jurisdiction.
            </li>
          </ul>
          <p className="pt-2 text-xs text-gray-500">
            TODO: Confirm arbitration seat and any industry-specific
            jurisdictional requirements with counsel.
          </p>
        </Section>

        {/* 12. Contact */}
        <Section id="contact" heading="12. Contact">
          <p>
            Questions about these Terms:{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-brand-maroon-600 underline"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <p className="pt-4 text-xs text-gray-500">
            TODO: Add Hindi translation of these Terms in a future release.
          </p>
        </Section>
      </article>
    </main>
  );
}
