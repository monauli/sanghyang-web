import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Photo } from './photo';
import type { Service } from '@/lib/types';

/**
 * Foto jadi latar penuh kartu, nama + tombol numpuk di atasnya pakai gradasi
 * — bukan foto lalu blok teks terpisah di bawah. Arah ini dari hasil
 * brainstorming desain Home (referensi Pinterest: kartu foto besar, CTA
 * ditumpuk di atas foto).
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
      className={`card-surface card-surface-hover group relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        isReservasi ? 'aspect-[4/5]' : 'aspect-square'
      }`}
    >
      <Photo
        src={service.photo_url}
        alt={service.name}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="transition-transform duration-700 ease-soft group-hover:scale-[1.04]"
      />
      {/* Gradien sama seperti header halaman kategori detail, supaya teks
          putih tetap terbaca berapa pun terangnya foto. */}
      <div className="absolute inset-0 bg-gradient-to-t from-sea-deep/90 via-sea-deep/30 to-transparent" />

      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col text-white ${isReservasi ? 'p-5 sm:p-6' : 'p-3 sm:p-3.5'}`}
      >
        <h3 className={`font-sans font-medium ${isReservasi ? 'text-lg' : 'text-sm'}`}>
          {service.name}
        </h3>
        {isReservasi && service.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/80">
            {service.description}
          </p>
        )}
        <span
          className={`mt-2.5 inline-flex items-center gap-1.5 font-medium ${
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
