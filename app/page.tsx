import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowDown, ShieldCheck } from 'lucide-react';
import { CategoryCard } from '@/components/category-card';
import { EmptyState } from '@/components/empty-state';
import { Photo } from '@/components/photo';
import { SectionHeading } from '@/components/section-heading';
import { Button } from '@/components/ui/button';
import { getServices } from '@/lib/supabase/queries';
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
  const [services, heroPhoto] = await Promise.all([getServices(), defaultOgImage()]);
  const bookable = services.filter((s) => s.is_bookable);
  const infoOnly = services.filter((s) => !s.is_bookable);

  return (
    <>
      {/* ---- Layar pertama: foto penuh, teks di bawah, tepi bawah melengkung ---- */}
      <section className="relative isolate flex min-h-[82svh] items-end overflow-hidden sm:min-h-[88svh] sm:rounded-b-[2.5rem]">
        <Photo src={heroPhoto} alt="" sizes="100vw" priority />
        {/* Dua lapis overlay: satu meratakan foto seterang apa pun, satu lagi
            menggelapkan bagian bawah tempat teks berada. Warnanya hijau-laut,
            bukan hitam, supaya tetap satu keluarga dengan palet. */}
        <div className="absolute inset-0 bg-sea-deep/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-sea-deep/95 via-sea-deep/45 to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 sm:px-8 sm:pb-20">
          <p className="eyebrow-light rise">Anyer, Banten</p>
          <h1 className="display rise rise-2 mt-4 max-w-3xl text-white">{SITE_NAME}</h1>
          <p className="rise rise-3 mt-5 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">
            Kemewahan yang menyatu dengan alam — kamar tepi pantai, dining, spa, dan beragam
            aktivitas untuk liburan keluarga.
          </p>
          <div className="rise rise-4 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="btn-pill">
              <Link href="#reservasi">
                Mulai reservasi
                <ArrowDown aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="btn-pill border-white/40 bg-white/10 text-white shadow-none backdrop-blur hover:bg-white/20 hover:text-white"
            >
              <Link href="/fasilitas">Lihat fasilitas</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ---- Bilah keyakinan: apa saja yang ada, langsung dari data ---- */}
      {bookable.length > 0 && (
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <ul className="-mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl bg-card px-5 py-4 text-sm shadow-soft ring-1 ring-foreground/[0.06] sm:-mt-8 sm:gap-x-8 sm:py-5">
            <li className="inline-flex items-center gap-2 font-medium text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Reservasi tanpa bayar di muka
            </li>
            {/* Nama kategori hanya di layar lebar — di HP bilahnya jadi sesak. */}
            {bookable.slice(0, 5).map((s) => (
              <li key={s.id} className="hidden text-muted-foreground sm:block">
                {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section id="reservasi" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24">
        <SectionHeading
          eyebrow="Reservasi"
          title="Bisa direservasi"
          subtitle="Kamar, tempat makan, dan layanan yang bisa Anda pesan lebih dulu. Kirim permintaan, tim kami yang mengonfirmasi."
        />
        {bookable.length === 0 ? (
          <EmptyState>
            Belum ada kategori yang bisa direservasi. Hubungi kami langsung untuk sementara.
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {bookable.map((service) => (
              <CategoryCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-sand-deep/60 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="Selama menginap"
            title="Fasilitas Kami"
            subtitle="Semuanya bisa dinikmati selama menginap, tanpa perlu reservasi."
          />
          {infoOnly.length === 0 ? (
            <EmptyState>Belum ada fasilitas yang ditampilkan.</EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
                {infoOnly.map((service) => (
                  <CategoryCard key={service.id} service={service} variant="fasilitas" />
                ))}
              </div>
              <div className="mt-10 text-center">
                <Button asChild variant="outline" className="btn-pill bg-card">
                  <Link href="/fasilitas">Lihat galeri lengkap</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
