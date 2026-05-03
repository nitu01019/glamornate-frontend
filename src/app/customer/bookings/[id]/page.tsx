import ClientPage from './PageClient';

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <ClientPage id={id} />;
}
