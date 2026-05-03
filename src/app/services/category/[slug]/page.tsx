import { catalogCategories } from '@/data/glamornate-catalog';
import ClientPage from './PageClient';

// Pre-render every real category slug so the static export (APK) has a
// matching index.html for each. The previous '_' sentinel meant only
// /services/category/_/index.html was emitted — every real slug 404'd
// inside the Capacitor WebView and fell back to the root, which the
// user perceived as a "refresh" when tapping a category card.
export async function generateStaticParams() {
  return catalogCategories.map((cat) => ({ slug: cat.slug }));
}

// Static export forbids `dynamicParams = true`. All 13 known slugs are
// pre-rendered above; unknown slugs will 404 at the HTML layer, which is
// fine since no UI path in the app links to an out-of-catalog category.

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return <ClientPage slug={slug} />;
}
