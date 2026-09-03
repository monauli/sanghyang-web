import type { Metadata } from 'next';
import { getServices } from '@/lib/supabase/queries';

export const SITE_NAME = 'Sanghyang Resort';
export const SITE_TAGLINE = 'Resort tepi pantai di Anyer, Banten';

/**
 * Dipakai untuk metadataBase, sitemap, robots, dan URL absolut di JSON-LD.
 * Wajib absolut supaya WhatsApp/Facebook bisa menarik gambarnya.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (raw && raw.replace(/\/$/, '')) || 'http://localhost:3000';
}

/** Foto default untuk kartu link. Diambil dari data yang sudah ada, bukan aset baru. */
export async function defaultOgImage(): Promise<string | null> {
  const services = await getServices();
  const withPhoto =
    services.find((s) => s.type === 'rooms' && s.photo_url) ??
    services.find((s) => s.is_bookable && s.photo_url) ??
    services.find((s) => s.photo_url);
  return withPhoto?.photo_url ?? null;
}

/** Judul + deskripsi + Open Graph + Twitter Card dalam satu tempat. */
export function pageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
}): Metadata {
  const url = `${siteUrl()}${path}`;
  const images = image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      siteName: SITE_NAME,
      title,
      description,
      url,
      images,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/** Potong deskripsi panjang jadi ringkasan yang enak dibaca di kartu link. */
export function summarize(text: string | null | undefined, fallback: string, max = 155): string {
  const clean = text?.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/[\s,.;:-]+$/, '')}…`;
}
