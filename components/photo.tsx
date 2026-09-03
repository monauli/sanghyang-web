import Image from 'next/image';

type PhotoProps = {
  src: string | null;
  alt: string;
  /** Diteruskan ke next/image; wajib karena semua pemakaian di sini `fill`. */
  sizes: string;
  className?: string;
  priority?: boolean;
};

/**
 * Foto dengan placeholder yang layak kalau `src` kosong. Selalu `fill`, jadi
 * pembungkusnya harus `relative` + punya tinggi.
 */
export function Photo({ src, alt, sizes, className = '', priority }: PhotoProps) {
  if (!src) return <PhotoPlaceholder label={alt} className={className} />;

  return (
    <>
      {/* Latar sewarna muted supaya kartu tidak berkedip putih selama foto
          (yang lazy-load) belum turun. */}
      <span className="absolute inset-0 bg-muted" aria-hidden="true" />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${className}`}
      />
    </>
  );
}

export function PhotoPlaceholder({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-accent text-primary/45 ${className}`}
      role="img"
      aria-label={label ? `Foto ${label} belum tersedia` : 'Foto belum tersedia'}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-8 w-8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 9.75h.008v.008H18V9.75zM2.25 6.75v10.5a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 6.75z"
        />
      </svg>
      <span className="text-xs font-medium">Foto belum tersedia</span>
    </div>
  );
}
