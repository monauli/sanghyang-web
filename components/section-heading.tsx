/** Judul section yang sama di semua halaman — supaya jarak, skala, dan
 *  eyebrow-nya konsisten. `eyebrow` adalah satu-satunya tempat warna senja
 *  dipakai secara rutin. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  as: Tag = 'h2',
  light = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  as?: 'h1' | 'h2';
  /** Judul di atas latar gelap (mis. section Reservasi bergaya wave). */
  light?: boolean;
}) {
  const isPage = Tag === 'h1';
  return (
    <div className={`${isPage ? 'mb-10' : 'mb-8'} max-w-2xl`}>
      {eyebrow && <p className={`${light ? 'eyebrow-light' : 'eyebrow'} mb-3`}>{eyebrow}</p>}
      <Tag className={`${isPage ? 'title-page' : 'title-section'} ${light ? 'text-white' : 'text-foreground'}`}>
        {title}
      </Tag>
      {subtitle && (
        <p
          className={`mt-3 max-w-xl text-[0.95rem] leading-relaxed sm:text-base ${light ? 'text-white/75' : 'text-muted-foreground'}`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
