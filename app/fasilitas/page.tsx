import type { Metadata } from 'next';
import { GalleryGrid, type GalleryEntry } from '@/components/gallery-grid';
import { EmptyState } from '@/components/empty-state';
import { SectionHeading } from '@/components/section-heading';
import { getItemsByServiceIds, getServices } from '@/lib/supabase/queries';
import { defaultOgImage, pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Fasilitas',
    description:
      'Kolam renang, taman, lapangan tenis, voli pantai, water sport, ruang rapat, dan fasilitas lain di Sanghyang Resort — semuanya bisa dinikmati selama menginap.',
    path: '/fasilitas',
    image: await defaultOgImage(),
  });
}

export default async function FasilitasPage() {
  const services = await getServices();
  const infoOnly = services.filter((s) => !s.is_bookable);
  const items = await getItemsByServiceIds(infoOnly.map((s) => s.id));

  const entries: GalleryEntry[] = infoOnly.map((service) => ({
    id: service.id,
    slug: service.type,
    name: service.name,
    description: service.description,
    photo_url: service.photo_url,
    items: items
      .filter((item) => item.service_id === service.id)
      .map(({ id, name, description }) => ({ id, name, description })),
  }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <SectionHeading
        as="h1"
        eyebrow="Selama menginap"
        title="Fasilitas Kami"
        subtitle="Semua fasilitas berikut bisa dinikmati selama menginap, tanpa perlu reservasi. Ketuk salah satu foto untuk melihatnya lebih besar beserta rinciannya."
      />

      {entries.length === 0 ? (
        <EmptyState>Belum ada fasilitas yang ditampilkan.</EmptyState>
      ) : (
        <GalleryGrid entries={entries} />
      )}
    </div>
  );
}
