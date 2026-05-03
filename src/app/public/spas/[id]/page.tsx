import type { Metadata } from 'next';
import ClientPage from './PageClient';

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
  const title = isPlaceholder
    ? 'Spa Listing | Glamornate'
    : 'Spa Profile (Public) | Glamornate';
  const description =
    'Browse a verified spa on Glamornate — therapists, services, and availability — no sign-in required.';
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
