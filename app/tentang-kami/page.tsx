import Link from 'next/link';
import type { Metadata } from 'next';
import { Photo } from '@/components/photo';
import { EmptyState } from '@/components/empty-state';
import { SectionHeading } from '@/components/section-heading';
import { Button } from '@/components/ui/button';
import { getServices, getSiteContent } from '@/lib/supabase/queries';
import { SITE_NAME, defaultOgImage, pageMetadata, summarize } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();

  return pageMetadata({
    title: 'Tentang Kami',
    description: summarize(
      content.about_us,
      `Mengenal ${SITE_NAME}, resort tepi pantai di Anyer dengan kamar, dining, spa, dan aktivitas keluarga.`
    ),
    path: '/tentang-kami',
    image: await defaultOgImage(),
  });
}

export default async function TentangKamiPage() {
  const [content, services, heroPhoto] = await Promise.all([
    getSiteContent(),
    getServices(),
    defaultOgImage(),
  ]);

  const paragraphs = (content.about_us ?? '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const bookable = services.filter((s) => s.is_bookable).length;
  const facilities = services.filter((s) => !s.is_bookable).length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <SectionHeading as="h1" eyebrow="Tentang kami" title={`Tentang ${SITE_NAME}`} />

      {heroPhoto && (
        <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-3xl shadow-soft sm:aspect-[21/9]">
          <Photo src={heroPhoto} alt={SITE_NAME} sizes="(max-width: 1024px) 100vw, 896px" priority />
        </div>
      )}

      {paragraphs.length === 0 ? (
        <EmptyState>Cerita tentang kami sedang disiapkan.</EmptyState>
      ) : (
        <div className="max-w-2xl space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-base leading-relaxed text-foreground/85 sm:text-lg">
              {p}
            </p>
          ))}
        </div>
      )}

      {services.length > 0 && (
        <dl className="mt-10 grid grid-cols-2 gap-4 sm:max-w-md">
          <div className="card-surface p-5">
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bisa direservasi
            </dt>
            <dd className="mt-1 font-heading text-3xl text-primary">{bookable}</dd>
          </div>
          <div className="card-surface p-5">
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fasilitas
            </dt>
            <dd className="mt-1 font-heading text-3xl text-primary">{facilities}</dd>
          </div>
        </dl>
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="btn-pill">
          <Link href="/#reservasi">Lihat yang bisa direservasi</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="btn-pill bg-card">
          <Link href="/kontak">Hubungi kami</Link>
        </Button>
      </div>
    </div>
  );
}
