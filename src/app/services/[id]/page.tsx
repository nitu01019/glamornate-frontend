import type { Metadata } from 'next';
import ClientPage from './PageClient';

// Mobile static export needs at least one pre-rendered entry; real service
// data is fetched client-side via React Query on the WebView.
export async function generateStaticParams() {
  return [{ id: '_' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const isPlaceholder = id === '_';
  const title = isPlaceholder ? 'Service Details | Glamornate' : 'Spa Service | Glamornate';
  const description =
    'Explore spa services on Glamornate — pricing, duration, therapists, and real customer reviews.';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <ClientPage id={id} />;
}
