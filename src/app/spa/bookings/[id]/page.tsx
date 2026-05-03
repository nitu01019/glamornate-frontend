import PageClient from './PageClient';

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export default async function SpaBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PageClient bookingId={id} />;
}
