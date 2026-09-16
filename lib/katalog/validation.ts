/** Parse input harga dari form (boleh ada "Rp", titik/spasi ribuan) jadi
 *  angka bulat rupiah. null kalau kosong atau tidak mengandung angka sama
 *  sekali. */
export function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}
