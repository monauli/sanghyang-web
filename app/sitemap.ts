import type { MetadataRoute } from 'next';
import { getServices } from '@/lib/supabase/queries';
import { siteUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/fasilitas`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tentang-kami`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/kontak`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
  ];

  const services = await getServices();
  const categories: MetadataRoute.Sitemap = services.map((s) => ({
    url: `${base}/kategori/${s.type}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: s.is_bookable ? 0.9 : 0.5,
  }));

  return [...statics, ...categories];
}
