/** "Kids Club!" -> "kids-club". Dipakai sekali saat kategori dibuat lewat
 *  dashboard; hasilnya dikunci selamanya karena dipakai di URL publik
 *  (/kategori/<slug>) — lihat Global Constraints di plan ini. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'kategori';
}

/** Tambah angka di belakang kalau slug-nya sudah dipakai kategori lain. */
export function uniqueSlug(base: string, existing: readonly string[]): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
