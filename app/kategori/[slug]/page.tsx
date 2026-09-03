import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { Photo } from '@/components/photo';
import { EmptyState } from '@/components/empty-state';
import { ReservationPanel } from '@/components/reservation-panel';
import { getItemsByServiceId, getServiceBySlug, getServices } from '@/lib/supabase/queries';
import { pageMetadata, summarize } from '@/lib/seo';
import { formatPrice, type ServiceItem } from '@/lib/types';

export async function generateStaticParams() {
  const services = await getServices();
  return services.map((s) => ({ slug: s.type }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return { title: 'Kategori tidak ditemukan' };

  return pageMetadata({
    title: service.name,
    description: summarize(
      service.description,
      service.is_bookable
        ? `Lihat pilihan ${service.name} di Sanghyang Resort dan kirim permintaan reservasi.`
        : `${service.name} di Sanghyang Resort, bisa dinikmati selama menginap.`
    ),
    path: `/kategori/${service.type}`,
    image: service.photo_url,
  });
}

export default async function KategoriPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const items = await getItemsByServiceId(service.id);
  const isExely = service.booking_method === 'exely';

  return (
    <article>
      <div className="relative h-72 w-full overflow-hidden sm:h-80 sm:rounded-b-[2.5rem] lg:h-[26rem]">
        <Photo src={service.photo_url} alt={service.name} sizes="100vw" priority />
        {/* Gradien hijau-laut cukup gelap supaya teks putih tetap terbaca
            berapa pun terangnya foto. */}
        <div className="absolute inset-0 bg-gradient-to-t from-sea-deep/90 via-sea-deep/40 to-sea-deep/10" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8 sm:pb-10">
            <nav aria-label="Remah roti">
              <ol className="flex items-center gap-1 text-sm text-white/90">
                <li>
                  <Link
                    href="/"
                    className="-my-1 inline-block rounded-sm py-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Beranda
                  </Link>
                </li>
                <ChevronRight className="size-3.5 text-white/60" aria-hidden="true" />
                <li aria-current="page" className="text-white">
                  {service.name}
                </li>
              </ol>
            </nav>
            <h1 className="title-page mt-2 text-white">{service.name}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {service.description && (
          <p className="max-w-2xl text-base leading-relaxed text-foreground/85 sm:text-lg">
            {service.description}
          </p>
        )}

        {service.is_bookable ? (
          <div className="mt-8 rounded-2xl bg-accent p-5 ring-1 ring-primary/10 sm:p-7">
            <div className="sm:flex sm:items-center sm:justify-between sm:gap-8">
              <div>
                <h2 className="font-sans text-base font-medium text-accent-foreground">
                  Tertarik dengan {service.name}?
                </h2>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-accent-foreground/80">
                  {isExely
                    ? 'Cek dulu kamar yang tersedia di tanggal Anda, lalu kirim permintaan. Belum ada pembayaran — tim kami menghubungi Anda untuk konfirmasi.'
                    : 'Kirim permintaan reservasi — belum ada pembayaran. Tim kami menghubungi Anda untuk konfirmasi ketersediaan.'}
                </p>
              </div>
              <div className="mt-5 shrink-0 sm:mt-0">
                <ReservationPanel
                  service={{
                    id: service.id,
                    name: service.name,
                    booking_method: service.booking_method,
                  }}
                  items={items.map(({ id, name, price }) => ({ id, name, price }))}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-8 rounded-2xl bg-card p-5 text-sm leading-relaxed text-muted-foreground ring-1 ring-foreground/[0.06]">
            Fasilitas ini bisa dinikmati langsung selama menginap, tanpa perlu reservasi.
          </p>
        )}

        <section className="mt-14 sm:mt-16">
          <p className="eyebrow mb-3">{service.is_bookable ? 'Pilihan' : 'Rincian'}</p>
          <h2 className="title-section text-foreground">
            {service.is_bookable ? 'Pilihan yang tersedia' : 'Yang tersedia di sini'}
          </h2>
          {service.is_bookable && isExely && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Harga di bawah adalah acuan. Harga pasti untuk tanggal Anda muncul saat cek
              ketersediaan.
            </p>
          )}

          {items.length === 0 ? (
            <div className="mt-6">
              <EmptyState>
                Daftar pilihan untuk kategori ini belum kami tampilkan.
                {service.is_bookable
                  ? ' Anda tetap bisa mengirim permintaan reservasi — tulis kebutuhan Anda di kolom catatan.'
                  : ' Hubungi kami kalau ingin tahu lebih detail.'}
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} showPrice={service.is_bookable} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}

function ItemCard({ item, showPrice }: { item: ServiceItem; showPrice: boolean }) {
  return (
    <li className="card-surface flex flex-col">
      <div className="relative aspect-[4/3] w-full">
        <Photo
          src={item.photo_url}
          alt={item.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-sans font-medium text-foreground">{item.name}</h3>
        {item.description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        )}
        {showPrice && (
          <p className="mt-auto pt-4 font-heading text-2xl font-semibold text-primary">
            <span className="sr-only">Harga </span>
            {formatPrice(item.price)}
          </p>
        )}
      </div>
    </li>
  );
}
