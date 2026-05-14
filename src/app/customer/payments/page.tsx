import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PaymentMethodsPageClient } from './_components/PaymentMethodsPageClient';

/**
 * /customer/payments
 *
 * Server wrapper: gates the route behind a customer-role check and delegates
 * rendering to the client container. No dynamic params, so no
 * generateStaticParams is needed.
 *
 * NOTE: UI-only shell. All "save / remove card" surfaces are disabled until
 * the payments backend is live.
 */
export default function PaymentMethodsPage() {
  return (
    <ProtectedRoute requiredRoles={['customer']}>
      <PaymentMethodsPageClient />
    </ProtectedRoute>
  );
}
