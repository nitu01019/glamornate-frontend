import { MetadataRoute } from 'next';

const BASE_URL = 'https://glamornate.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
    '/services',
    '/spas',
    '/offers',
    '/about',
    '/contact',
    '/help',
    '/partner',
    '/referral',
    '/blog',
    '/privacy',
    '/terms',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? ('daily' as const) : ('weekly' as const),
    priority: route === '' ? 1 : 0.8,
  }));

  return staticRoutes;
}
