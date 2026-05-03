import type { Metadata } from 'next';
import ClientPage from './PageClient';

// Mobile static export needs at least one pre-rendered entry; real content
// is fetched client-side via React Query once the WebView mounts.
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
  const title = isPlaceholder ? 'Spa Details | Glamornate' : 'Spa Profile | Glamornate';
  const description =
    'Discover therapists, services, ratings, and availability at verified partner spas on Glamornate.';
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
