import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/spa/', '/customer/', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://glamornate.com/sitemap.xml',
  };
}
