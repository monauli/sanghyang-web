/** Judul section yang sama di semua halaman — supaya jarak, skala, dan
 *  eyebrow-nya konsisten. `eyebrow` adalah satu-satunya tempat warna senja
 *  dipakai secara rutin. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  as: Tag = 'h2',
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  as?: 'h1' | 'h2';
}) {
  const isPage = Tag === 'h1';
  return (
    <div className={`${isPage ? 'mb-10' : 'mb-8'} max-w-2xl`}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <Tag className={`${isPage ? 'title-page' : 'title-section'} text-foreground`}>{title}</Tag>
      {subtitle && (
        <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}
