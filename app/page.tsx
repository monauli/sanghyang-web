import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, MapPin } from 'lucide-react';
import { CategoryIconRow } from '@/components/category-icon-row';
import { HeroSidebar } from '@/components/hero-sidebar';
import { Photo } from '@/components/photo';
import { getServices, getSiteContent } from '@/lib/supabase/queries';
import { SITE_NAME, SITE_TAGLINE, defaultOgImage, pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      'Kamar tepi pantai, restoran, spa, kolam renang, dan aktivitas air di Anyer. Lihat pilihan yang tersedia lalu kirim permintaan reservasi — tim kami yang menghubungi Anda.',
    path: '/',
    image: await defaultOgImage(),
  });
}

export default async function Home() {
  const [services, content] = await Promise.all([getServices(), getSiteContent()]);
  const bookable = services.filter((s) => s.is_bookable);

  return (
    <section className="flex min-h-svh bg-sea-deep">
      <HeroSidebar contactPhone={content.contact_phone} />

      <div className="relative isolate mb-5 flex flex-1 flex-col overflow-hidden sm:mb-8">
        <Photo src="/hero/aerial-1.webp" alt="" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-sea-deep/70 via-sea-deep/25 to-transparent" />

        {/* Baris atas foto: lokasi kiri, tombol reservasi kanan */}
        <div className="relative flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
          <p className="flex items-center gap-1.5 text-xs font-medium text-white sm:text-sm">
            <MapPin className="size-4" aria-hidden="true" />
            Anyer, Banten
          </p>
          <Link
            href="/kontak"
            className="rounded-full bg-white/20 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30 sm:text-sm"
          >
            Reservasi
          </Link>
        </div>

        {/* Judul + deskripsi + link jelajah */}
        <div className="relative mt-10 max-w-lg flex-1 px-5 sm:mt-16 sm:px-8">
          <h1 className="display-script rise text-white">
            {SITE_NAME.split(' ')[0]}
            <span className="ml-10 block text-[0.62em] sm:ml-16">{SITE_NAME.split(' ')[1]}</span>
          </h1>
          <p className="rise rise-2 mt-6 text-sm leading-relaxed text-white/90 sm:text-base">
            Kemewahan yang menyatu dengan alam — kamar tepi pantai, dining, spa, dan beragam
            aktivitas untuk liburan keluarga di Anyer.
          </p>
          <Link
            href="/fasilitas"
            className="rise rise-3 mt-5 inline-flex items-center gap-2 border-b border-white/60 pb-1 text-sm text-white transition-colors hover:border-white"
          >
            Jelajahi
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Kartu kategori di tepi bawah foto */}
        <div className="relative mt-10 px-5 pb-5 sm:px-8 sm:pb-7">
          <CategoryIconRow services={bookable} />
        </div>
      </div>
    </section>
  );
}
