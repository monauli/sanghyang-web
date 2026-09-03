import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Halaman "terima kasih" dan endpoint internal tidak ada gunanya di hasil pencarian.
      disallow: ['/api/', '/reservasi/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
