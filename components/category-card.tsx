import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Photo } from './photo';
import type { Service } from '@/lib/types';

/**
 * Foto di atas, kartu putih terpisah di bawah untuk teks — bukan overlay.
 * Arah ini dari referensi Pinterest (kartu artikel: foto lalu blok teks
 * putih dengan judul, deskripsi, dan link "Lihat lebih").
 *
 * `reservasi` — kartu besar dengan deskripsi, dipakai di section Reservasi.
 * `fasilitas` — kartu galeri ringkas tanpa deskripsi, tanpa isyarat booking.
 */
export function CategoryCard({
  service,
  variant = 'reservasi',
}: {
  service: Service;
  variant?: 'reservasi' | 'fasilitas';
}) {
  const isReservasi = variant === 'reservasi';

  return (
    <Link
      href={`/kategori/${service.type}`}
      className="card-surface card-surface-hover group block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className={`relative overflow-hidden ${isReservasi ? 'aspect-[4/3]' : 'aspect-square'}`}>
        <Photo
          src={service.photo_url}
          alt={service.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="transition-transform duration-700 ease-soft group-hover:scale-[1.04]"
        />
      </div>

      <div className={isReservasi ? 'p-5 sm:p-6' : 'p-3 sm:p-3.5'}>
        <h3 className={`font-sans font-medium ${isReservasi ? 'text-lg' : 'text-sm'}`}>
          {service.name}
        </h3>
        {isReservasi && service.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {service.description}
          </p>
        )}
        <span
          className={`mt-2.5 inline-flex items-center gap-1.5 font-medium text-primary ${
            isReservasi ? 'text-sm' : 'text-xs'
          }`}
        >
          {isReservasi ? 'Lihat & reservasi' : 'Lihat detail'}
          <ArrowRight
            className="size-3.5 transition-transform duration-300 ease-soft group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}
