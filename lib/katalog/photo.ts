import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'katalog';
const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const MAX_BYTES = 4 * 1024 * 1024;

export class FotoError extends Error {}

/** Upload satu file foto ke bucket katalog, return public URL-nya. File
 *  diasumsikan sudah dikompresi di browser (lihat components/compressed-
 *  photo-input.tsx) — validasi di sini adalah jaring pengaman kedua. */
export async function uploadKatalogFoto(supabase: SupabaseClient, file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new FotoError('Format foto tidak didukung. Pakai JPG, PNG, atau WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new FotoError('Ukuran foto kegedean (maks 4MB).');
  }

  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
  });
  if (error) throw new FotoError(`Upload gagal: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Hapus foto lama dari Storage, tapi HANYA kalau memang berasal dari bucket
 *  katalog kita sendiri — 15 kategori & 35 item yang sudah ada fotonya masih
 *  di domain sanghyang.com, jangan disentuh (lihat spec). */
export async function deleteFotoJikaMilikKita(
  supabase: SupabaseClient,
  url: string | null
): Promise<void> {
  if (!url) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
