import type { Metadata } from 'next';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Glamornate collects, uses, shares, and protects your personal information.',
  robots: { index: true, follow: true },
};

// ---------------------------------------------------------------------------
// Static Data (hoisted outside component — see rendering-hoist-jsx rule)
// ---------------------------------------------------------------------------

const LAST_UPDATED = '2026-04-20';
// TODO: confirm the final support email before public launch.
const SUPPORT_EMAIL = 'support@glamornate.example';
const PRIVACY_EMAIL = 'privacy@glamornate.example';
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
// Page (Server Component — no interactivity, Play-Store-review friendly)
// ---------------------------------------------------------------------------

export default function PrivacyPolicyPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-white pb-24 animate-fade-in"
    >
      {/* Header */}
      <header className="border-b border-gray-100 bg-white px-5 pt-14 pb-6">
        <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-1 text-xs text-gray-500">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          This Privacy Policy explains how {COMPANY_NAME} (&ldquo;Glamornate&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) handles information about
          you when you use our mobile app, website, or related services
          (collectively, the &ldquo;Services&rdquo;).
        </p>
      </header>

      {/* Content */}
      <article className="px-5 pt-2">
        {/* 1. Who we are */}
        <Section id="who-we-are" heading="1. Who we are">
          <p>
            Glamornate is a spa and wellness booking platform operated by{' '}
            {COMPANY_NAME}, registered in India. We help customers discover spas,
            book at-home and in-salon services, and pay for those services
            securely.
          </p>
          <p>
            If you have questions about this policy, email us at{' '}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="text-brand-maroon-600 underline"
            >
              {PRIVACY_EMAIL}
            </a>
            .
          </p>
        </Section>

        {/* 2. What data we collect */}
        <Section id="data-we-collect" heading="2. What data we collect">
          <p>
            We only collect the information we need to run the Services. Here is
            the complete list:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Account data.</strong> Name, email address, phone number,
              password hash (never the plaintext), and optional profile photo.
            </li>
            <li>
              <strong>Booking data.</strong> The spa, service, date, time, price,
              and therapist you booked, plus any notes you added.
            </li>
            <li>
              <strong>Location data.</strong> When you grant permission, we
              record a precise location (latitude/longitude) so we can show you
              nearby spas and autocomplete your delivery address. You can revoke
              this permission in your device settings at any time.
            </li>
            <li>
              <strong>Addresses.</strong> If you save an address for at-home
              service, we store the street line, city, state, pincode, and
              optional landmark.
            </li>
            <li>
              <strong>Payment data.</strong> Glamornate does not collect or
              store payment information. Payment for your service happens
              directly at the spa, on their own terms.
            </li>
            <li>
              <strong>Reviews and ratings.</strong> Any review text, star
              rating, and photos you post about a service you booked.
            </li>
            <li>
              <strong>Device data.</strong> Firebase Cloud Messaging (FCM) token
              for push notifications, approximate device type, OS version, and
              app version. Used for delivering alerts and debugging crashes.
            </li>
            <li>
              <strong>App activity.</strong> Pages viewed, buttons tapped,
              bookings started, and similar usage events used to improve the
              product. We do not combine this data with ad networks.
            </li>
            <li>
              <strong>Audit metadata.</strong> When you perform sensitive
              actions such as deleting your account, we record a timestamped,
              hashed log (no raw email or phone) for fraud and dispute
              resolution.
            </li>
          </ul>
        </Section>

        {/* 3. How we use it */}
        <Section id="how-we-use-data" heading="3. How we use your data">
          <ul className="list-disc pl-5 space-y-2">
            <li>To create and maintain your account.</li>
            <li>
              To confirm, deliver, and remind you about bookings, including
              sharing your name and phone with the spa you booked.
            </li>
            <li>To process payments and issue refunds.</li>
            <li>
              To send transactional notifications (booking confirmations,
              reminders, and service updates).
            </li>
            <li>
              To send promotional messages only when you have opted in. You can
              opt out in app settings or by replying STOP to SMS.
            </li>
            <li>
              To investigate fraud, abuse, and violations of our Terms of
              Service.
            </li>
            <li>To comply with legal obligations in India (see section 7).</li>
          </ul>
        </Section>

        {/* 4. Who we share with */}
        <Section id="who-we-share-with" heading="4. Who we share your data with">
          <p>
            We never sell your personal data. We share the minimum necessary
            data with the following categories of processors:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Google Firebase (Google LLC).</strong> Authentication,
              Firestore database, Cloud Functions, Cloud Storage, Cloud
              Messaging, and Analytics. Data is hosted primarily in the US
              Central region.
            </li>
            <li>
              <strong>Spa partners.</strong> When you book, the partner spa
              receives your name, phone number, booking time, and service
              details so they can serve you.
            </li>
            <li>
              <strong>Law enforcement or courts.</strong> When we are legally
              compelled by a valid Indian court order or summons.
            </li>
          </ul>
          <p>
            We do not share your data with advertising networks, data brokers,
            or third-party analytics beyond Firebase Analytics.
          </p>
        </Section>

        {/* 5. International transfers */}
        <Section
          id="international-transfers"
          heading="5. International transfers"
        >
          <p>
            Firebase hosts our data in the United States (us-central1 region).
            Data in transit is encrypted with TLS. Data at rest is encrypted by
            Google using AES-256 or equivalent. By using Glamornate, you consent
            to this cross-border transfer under India&apos;s Digital Personal
            Data Protection Act, 2023 (DPDP Act).
          </p>
        </Section>

        {/* 6. How long we keep it */}
        <Section id="retention" heading="6. How long we keep your data">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Account data:</strong> for as long as your account is
              active.
            </li>
            <li>
              <strong>Booking and payment records:</strong> 7 years after the
              last transaction, to comply with Indian tax and accounting law.
            </li>
            <li>
              <strong>Audit logs (hashed):</strong> 7 years, retained under the
              legitimate-interest derogation in the DPDP Act and Art. 17(3)(b)
              of the GDPR.
            </li>
            <li>
              <strong>Marketing preferences:</strong> until you opt out, then
              30 days in a suppression list.
            </li>
            <li>
              <strong>Crash and performance logs:</strong> 90 days.
            </li>
          </ul>
        </Section>

        {/* 7. Your rights */}
        <Section id="your-rights" heading="7. Your rights">
          <p>Under the DPDP Act and applicable data protection laws, you can:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Access</strong> the personal data we hold about you.
            </li>
            <li>
              <strong>Correct</strong> inaccurate or outdated information.
            </li>
            <li>
              <strong>Delete</strong> your account and associated personal data
              (see In-app deletion below).
            </li>
            <li>
              <strong>Port</strong> your data in a machine-readable format by
              emailing {PRIVACY_EMAIL}.
            </li>
            <li>
              <strong>Withdraw consent</strong> for marketing at any time.
            </li>
            <li>
              <strong>Complain</strong> to the Indian Data Protection Board if
              you believe we have mishandled your data.
            </li>
          </ul>
        </Section>

        {/* 8. In-app deletion */}
        <Section id="in-app-deletion" heading="8. In-app deletion">
          <p>
            You can permanently delete your account and all associated personal
            data from within the app:
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open the app and tap the Account tab.</li>
            <li>
              Scroll to the bottom and tap <strong>Delete Account</strong>.
              Confirm the prompt.
            </li>
          </ol>
          <p>
            For the web-based alternative path, see{' '}
            <Link
              href="/data-deletion"
              className="text-brand-maroon-600 underline"
            >
              our Data Deletion page
            </Link>
            . We process deletion requests within 30 days. A hashed audit log
            may be retained for up to 7 years as described in section 6.
          </p>
        </Section>

        {/* 9. Children's data */}
        <Section id="children" heading="9. Children's data">
          <p>
            Glamornate is intended for users 18 years and older. We do not
            knowingly collect data from anyone under 18. If you believe a minor
            has created an account, email {PRIVACY_EMAIL} and we will delete the
            account and its data.
          </p>
        </Section>

        {/* 10. Security */}
        <Section id="security" heading="10. How we protect your data">
          <p>
            We follow industry-standard practices to protect your data:
            TLS 1.2+ for data in transit, AES-256 or equivalent for data at
            rest, strict Firestore Security Rules that prevent cross-user reads,
            App Check on Cloud Functions, and limited administrator access with
            audit logging. No system is perfectly secure; we commit to notifying
            affected users within 72 hours of discovering a breach that affects
            their personal data.
          </p>
        </Section>

        {/* 11. Changes */}
        <Section id="changes" heading="11. Changes to this policy">
          <p>
            If we materially change this policy, we will update the
            &ldquo;Last updated&rdquo; date at the top and, for substantive
            changes, send an in-app notice or email. Continued use of the
            Services after the effective date means you accept the updated
            terms.
          </p>
        </Section>

        {/* 12. Governing law */}
        <Section id="governing-law" heading="12. Governing law">
          <p>
            This policy is governed by the laws of India. Any dispute will be
            subject to the exclusive jurisdiction of the courts in Bengaluru,
            Karnataka.
          </p>
        </Section>

        {/* 13. Contact */}
        <Section id="contact" heading="13. Contact us">
          <p>For privacy questions or requests:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Email:{' '}
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="text-brand-maroon-600 underline"
              >
                {PRIVACY_EMAIL}
              </a>
            </li>
            <li>
              Support:{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-brand-maroon-600 underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>{COMPANY_NAME}</li>
          </ul>
          <p className="pt-4 text-xs text-gray-500">
            TODO: Add Hindi translation of this policy in a future release.
          </p>
        </Section>
      </article>
    </main>
  );
}
